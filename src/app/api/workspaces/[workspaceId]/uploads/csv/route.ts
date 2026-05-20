// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CRYPTO AUDIT MASTER — CSV Upload API
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// POST /api/workspaces/:workspaceId/uploads/csv
//   Accepts multipart form data with CSV file(s).
//   For each file: hash check, parse, validate, store trades.
//
// Flow:
//   1. Auth + workspace ownership check
//   2. Read file content from form data
//   3. Compute SHA-256 hash → check for duplicates in same workspace
//   4. Parse CSV using csv-parser service
//   5. Store CsvFile record + all valid Trade records
//   6. Return upload summary
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth-middleware'
import { verifyWorkspaceOwnership } from '@/lib/workspace-auth'
import { successResponse, errorResponse } from '@/lib/api-response'
import { sha256 } from '@/lib/hash'
import { parseCsvContent } from '@/lib/csv-parser'
import * as fs from 'fs'
import * as path from 'path'

type RouteContext = { params: Promise<{ workspaceId: string }> }

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    // ── Step 1: Authentication & Authorization ──
    const { userId } = authenticateRequest(request)
    const { workspaceId } = await context.params
    await verifyWorkspaceOwnership(workspaceId, userId)

    // ── Step 2: Read file from form data ──
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return errorResponse('No file uploaded', 400)
    }

    // Validate file type
    const fileName = file.name.toLowerCase()
    if (!fileName.endsWith('.csv') && file.type !== 'text/csv' && !file.type.includes('spreadsheet') && !file.type.includes('csv')) {
      return errorResponse('Only CSV files are accepted', 422)
    }

    // Read file content
    const buffer = Buffer.from(await file.arrayBuffer())
    const content = buffer.toString('utf-8')

    if (!content || content.trim().length === 0) {
      return errorResponse('CSV file is empty', 422)
    }

    // ── Step 3: Compute hash and check for duplicates ──
    const fileHash = sha256(content)

    const existingFile = await db.csvFile.findFirst({
      where: {
        workspaceId,
        fileHash,
      },
    })

    if (existingFile) {
      return successResponse(
        {
          csvFileId: existingFile.id,
          originalName: existingFile.originalName,
          isDuplicate: true,
          message: 'This CSV file has already been uploaded to this workspace',
          existingValidRows: existingFile.validRows,
          existingTotalRows: existingFile.totalRows,
        },
        'Duplicate CSV file detected',
      )
    }

    // ── Step 4: Parse and validate CSV ──
    const parseResult = parseCsvContent(content)

    // Check if required fields are missing
    if (parseResult.requiredMapping.length > 0 && parseResult.trades.length === 0) {
      return errorResponse(
        `Could not auto-detect required columns: ${parseResult.requiredMapping.join(', ')}. Please use the column mapping feature.`,
        422,
        parseResult.requiredMapping,
      )
    }

    // ── Step 5: Store CsvFile record ──
    const csvFile = await db.csvFile.create({
      data: {
        userId,
        workspaceId,
        originalName: file.name,
        storedName: `${Date.now()}-${file.name}`,
        fileHash,
        fileSize: buffer.length,
        mimeType: 'text/csv',
        totalRows: parseResult.totalRows,
        validRows: parseResult.validRows,
        skippedRows: parseResult.skippedRows,
        skipReasons: JSON.stringify(parseResult.skipReasons),
      },
    })

    // Save file to disk for re-processing later
    try {
      const uploadDir = path.join(process.cwd(), 'upload')
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true })
      }
      const filePath = path.join(uploadDir, csvFile.storedName)
      fs.writeFileSync(filePath, content, 'utf-8')
    } catch (diskError) {
      console.error('[CSV DISK SAVE WARNING]', diskError)
      // Non-critical: file not saving to disk shouldn't fail the upload
    }

    // ── Step 6: Store all valid trades ──
    if (parseResult.trades.length > 0) {
      await db.trade.createMany({
        data: parseResult.trades.map(trade => ({
          userId,
          workspaceId,
          csvFileId: csvFile.id,
          tradeTime: trade.tradeTime,
          pair: trade.pair,
          asset: trade.asset,
          side: trade.side,
          qty: trade.qty,
          price: trade.price,
          orderValue: trade.orderValue,
          fee: trade.fee,
          tds: trade.tds,
          rawRow: trade.rawRow,
        })),
      })
    }

    // ── Step 7: Return upload summary ──
    return successResponse(
      {
        csvFileId: csvFile.id,
        originalName: file.name,
        fileHash,
        totalRows: parseResult.totalRows,
        validRows: parseResult.validRows,
        skippedRows: parseResult.skippedRows,
        skipReasons: parseResult.skipReasons,
        detectedColumns: parseResult.detectedColumns,
        unmappedColumns: parseResult.unmappedColumns,
        requiredMapping: parseResult.requiredMapping,
        isDuplicate: false,
      },
      `CSV uploaded successfully. ${parseResult.validRows} trades imported, ${parseResult.skippedRows} rows skipped.`,
      201,
    )
  } catch (err) {
    if (err instanceof Error && (err.message.includes('Authorization') || err.message.includes('token'))) {
      return errorResponse(err.message, 401)
    }
    if (err instanceof Error && (err.message.includes('Workspace not found') || err.message.includes('access'))) {
      return errorResponse(err.message, 403)
    }
    console.error('[CSV UPLOAD ERROR]', err)
    return errorResponse('Internal server error', 500)
  }
}
