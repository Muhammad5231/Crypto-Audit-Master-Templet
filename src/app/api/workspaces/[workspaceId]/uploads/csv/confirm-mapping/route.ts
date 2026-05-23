// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CRYPTO AUDIT MASTER — CSV Column Mapping Confirmation API
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// POST /api/workspaces/:workspaceId/uploads/csv/confirm-mapping
//   Accepts a user-provided column mapping and processes the CSV.
//   This is the second step of the Column Mapping feature:
//   1. User uploads CSV → /analyze returns detected + unmapped columns
//   2. User adjusts mapping → /confirm-mapping processes with custom mapping
//
// Request Body:
//   {
//     csvFileId?: string,           // If re-processing an already-uploaded file
//     fileContent?: string,         // Raw CSV content (if not using existing file)
//     mappingConfig: {              // Maps original column names to normalized fields
//       "Filled Amount": "QTY",
//       "Direction": "SIDE",
//       "Trade Rate": "PRICE"
//     },
//     sideValueMap?: {              // Custom side value mapping
//       "1": "BUY",
//       "0": "SELL"
//     },
//     dateFormat?: string           // Optional date format hint
//   }
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
    // ── Authentication & Authorization ──
    const { userId } = authenticateRequest(request)
    const { workspaceId } = await context.params
    await verifyWorkspaceOwnership(workspaceId, userId)

    // ── Parse request body ──
    const body = await request.json()
    const { csvFileId, fileContent, mappingConfig, sideValueMap, fileName, exchangeName, buyFeePercent, sellFeePercent, mappingMode } = body

    // Validate that either csvFileId or fileContent is provided
    if (!csvFileId && !fileContent) {
      return errorResponse('Either csvFileId or fileContent must be provided', 422)
    }

    if (!mappingConfig || typeof mappingConfig !== 'object' || Object.keys(mappingConfig).length === 0) {
      return errorResponse('mappingConfig is required and must be a non-empty object', 422)
    }

    let content: string
    let originalName: string

    if (csvFileId) {
      // ── Re-processing an existing CSV file ──
      const existingFile = await db.csvFile.findFirst({
        where: { id: csvFileId, workspaceId, userId },
      })

      if (!existingFile) {
        return errorResponse('CSV file not found in this workspace', 404)
      }

      // We need the raw content — but since we didn't store it, we can't re-parse.
      // Instead, we need to delete the old trades and re-process from fileContent.
      // For this flow, fileContent should be provided along with csvFileId.
      if (!fileContent) {
        return errorResponse(
          'fileContent must be provided alongside csvFileId for re-processing',
          422,
        )
      }

      content = fileContent
      originalName = existingFile.originalName
    } else {
      // ── Processing new CSV with custom mapping ──
      content = fileContent
      originalName = fileName || 'uploaded-file.csv'
    }

    if (!content || content.trim().length === 0) {
      return errorResponse('CSV content is empty', 422)
    }

    // ── Compute hash and check for duplicates ──
    const fileHash = sha256(content)

    // If same hash as existing file exists, delete it and reprocess.
    // The whole point of /confirm-mapping is to reprocess with user-provided
    // mapping, so returning an old (possibly broken) duplicate defeats the purpose.
    const existingByHash = await db.csvFile.findFirst({
      where: { workspaceId, fileHash },
    })
    if (existingByHash) {
      // Delete existing trades and the CsvFile record so we can reprocess
      await db.trade.deleteMany({
        where: { csvFileId: existingByHash.id },
      })
      await db.csvFile.delete({
        where: { id: existingByHash.id },
      })
    }

    // ── Parse CSV with user-provided mapping ──
    const parseResult = parseCsvContent(content, mappingConfig, sideValueMap)

    if (parseResult.trades.length === 0 && parseResult.requiredMapping.length > 0) {
      return errorResponse(
        `After applying your mapping, required columns are still missing: ${parseResult.requiredMapping.join(', ')}`,
        422,
        parseResult.requiredMapping,
      )
    }

    // ── If re-processing via csvFileId, ensure the old record is also cleaned up ──
    // Note: the hash-based check above may have already deleted this record if the
    // content matches. This block handles the case where csvFileId points to a
    // different record (different hash) that still needs cleanup.
    if (csvFileId && csvFileId !== existingByHash?.id) {
      const stillExists = await db.csvFile.findFirst({
        where: { id: csvFileId, workspaceId },
      })
      if (stillExists) {
        await db.trade.deleteMany({
          where: { csvFileId },
        })
        await db.csvFile.delete({
          where: { id: csvFileId },
        })
      }
    }

    // ── Store new CsvFile record ──
    const csvFile = await db.csvFile.create({
      data: {
        userId,
        workspaceId,
        originalName,
        storedName: `${Date.now()}-${originalName}`,
        fileHash,
        fileSize: Buffer.byteLength(content, 'utf-8'),
        mimeType: 'text/csv',
        totalRows: parseResult.totalRows,
        validRows: parseResult.validRows,
        skippedRows: parseResult.skippedRows,
        skipReasons: JSON.stringify(parseResult.skipReasons),
        exchangeName: exchangeName || '',
        buyFeePercent: buyFeePercent || '0',
        sellFeePercent: sellFeePercent || '0',
        mappingMode: mappingMode || (Object.keys(mappingConfig).length > 0 ? 'manual' : 'auto'),
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

    // ── Store all valid trades ──
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

    // ── Auto-generate report after storing trades ──
    // This ensures all pages (Dashboard, Realized Trades, Open Holdings, Tax Summary)
    // have data immediately after CSV upload — no manual "Process Report" step needed.
    let reportGenerated = false
    if (parseResult.trades.length > 0) {
      try {
        // ── Auto-detect Delta Exchange and configure settings ──
        // Delta Exchange India CSVs include GST in their "Trading Fees" column
        // and have 0 buy fees. We auto-configure the workspace settings accordingly.
        const detectedExchange = (exchangeName || '').toLowerCase()
        const isDeltaExchange = detectedExchange.includes('delta')
          || originalName.toLowerCase().includes('delta')
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
        }

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

    // ── Return processing summary ──
    return successResponse(
      {
        csvFileId: csvFile.id,
        originalName,
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
        exchangeName: exchangeName || '',
        buyFeePercent: buyFeePercent || '0',
        sellFeePercent: sellFeePercent || '0',
        mappingMode: mappingMode || (Object.keys(mappingConfig).length > 0 ? 'manual' : 'auto'),
      },
      `CSV processed with custom mapping. ${parseResult.validRows} trades imported, ${parseResult.skippedRows} rows skipped.${reportGenerated ? ' Report auto-generated.' : ''}`,
      201,
    )
  } catch (err) {
    if (err instanceof Error && (err.message.includes('Authorization') || err.message.includes('token'))) {
      return errorResponse(err.message, 401)
    }
    if (err instanceof Error && (err.message.includes('Workspace not found') || err.message.includes('access'))) {
      return errorResponse(err.message, 403)
    }
    console.error('[CSV CONFIRM MAPPING ERROR]', err)
    return errorResponse('Internal server error', 500)
  }
}
