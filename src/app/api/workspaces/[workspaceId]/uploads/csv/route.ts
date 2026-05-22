// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CRYPTO AUDIT MASTER — CSV Upload API
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// POST /api/workspaces/:workspaceId/uploads/csv
//   Accepts multipart form data with CSV file(s).
//   For each file: hash check, parse, validate, store trades,
//   auto-detect Delta Exchange, and auto-generate report.
//
// Flow:
//   1. Auth + workspace ownership check
//   2. Read file content from form data
//   3. Compute SHA-256 hash → delete old duplicate + reprocess
//   4. Parse CSV using csv-parser service
//   5. Store CsvFile record + all valid Trade records
//   6. Auto-detect Delta Exchange → set feesIncludeGst
//   7. Auto-generate FIFO + Tax report
//   8. Return upload summary with reportGenerated flag
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth-middleware'
import { verifyWorkspaceOwnership } from '@/lib/workspace-auth'
import { successResponse, errorResponse } from '@/lib/api-response'
import { sha256 } from '@/lib/hash'
import { parseCsvContent } from '@/lib/csv-parser'
import { generateReport } from '@/lib/report-builder'
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
    // If same hash exists, delete old file + trades so we can reprocess
    // with fresh settings (e.g., feesIncludeGst may have changed).
    const fileHash = sha256(content)

    const existingFile = await db.csvFile.findFirst({
      where: {
        workspaceId,
        fileHash,
      },
    })

    if (existingFile) {
      // Delete old trades and CsvFile so we can reprocess from scratch
      await db.trade.deleteMany({
        where: { csvFileId: existingFile.id },
      })
      await db.csvFile.delete({
        where: { id: existingFile.id },
      })
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

    // ── Step 7: Auto-detect Delta Exchange & configure settings ──
    // Delta Exchange India CSVs include GST in their "Trading Fees" column
    // and have 0 buy fees. We auto-configure the workspace settings accordingly.
    let isDeltaExchange = false
    if (parseResult.trades.length > 0) {
      isDeltaExchange = file.name.toLowerCase().includes('delta')
        || parseResult.trades.some(t => t.pair.includes('_INR') && t.fee === '0' && t.side === 'BUY')

      if (isDeltaExchange) {
        const existingSettings = await db.exchangeSettings.findFirst({ where: { workspaceId } })
        if (existingSettings) {
          await db.exchangeSettings.update({
            where: { id: existingSettings.id },
            data: {
              feesIncludeGst: true,
              applyDefaultFees: false,
            },
          })
        } else {
          await db.exchangeSettings.create({
            data: {
              userId,
              workspaceId,
              feesIncludeGst: true,
              applyDefaultFees: false,
            },
          })
        }

        // Update CsvFile record with exchange name
        await db.csvFile.update({
          where: { id: csvFile.id },
          data: { exchangeName: 'Delta Exchange' },
        })
      }
    }

    // ── Step 8: Auto-generate report after storing trades ──
    // This ensures all pages (Dashboard, Realized Trades, Open Holdings, Tax Summary)
    // have data immediately after CSV upload — no manual "Process Report" step needed.
    let reportGenerated = false
    if (parseResult.trades.length > 0) {
      try {
        // Delete old reports for this workspace to avoid stale data
        await db.report.deleteMany({
          where: { workspaceId },
        })

        // Generate a fresh report using the FIFO + tax engines
        const report = await generateReport(workspaceId, userId)

        // Get all source CSV file IDs
        const csvFiles = await db.csvFile.findMany({
          where: { workspaceId },
          select: { id: true },
        })

        // Save the report to the database
        await db.report.create({
          data: {
            userId,
            workspaceId,
            sourceCsvFiles: JSON.stringify(csvFiles.map(f => f.id)),
            summary: JSON.stringify(report.summary),
            realizedTrades: JSON.stringify(report.realizedTrades),
            openHoldings: JSON.stringify(report.openHoldings),
            warnings: JSON.stringify(report.warnings),
            taxSummary: JSON.stringify(report.taxResult.summary),
          },
        })
        reportGenerated = true
      } catch (reportErr) {
        // Report generation failure is non-critical — trades are still stored.
        // The user can manually trigger "Process Report" from the dashboard.
        console.error('[AUTO-REPORT GENERATION WARNING]', reportErr)
      }
    }

    // ── Step 9: Return upload summary ──
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
        reportGenerated,
        isDeltaExchange,
      },
      `CSV uploaded successfully. ${parseResult.validRows} trades imported, ${parseResult.skippedRows} rows skipped.${reportGenerated ? ' Report auto-generated.' : ''}${isDeltaExchange ? ' Delta Exchange detected — GST included in fees.' : ''}`,
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
