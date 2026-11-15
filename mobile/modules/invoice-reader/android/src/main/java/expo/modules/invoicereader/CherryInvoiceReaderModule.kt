package expo.modules.invoicereader

import android.graphics.Bitmap
import android.graphics.Matrix
import android.graphics.pdf.PdfRenderer
import android.net.Uri
import android.os.ParcelFileDescriptor
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.util.UUID

class CherryInvoiceReaderModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("CherryInvoiceReader")

    AsyncFunction("renderPdfPages") Coroutine { pdfUri: String ->
      return@Coroutine withContext(Dispatchers.IO) {
        val context = appContext.reactContext ?: throw IllegalStateException("Android context is unavailable")
        val descriptor: ParcelFileDescriptor = context.contentResolver.openFileDescriptor(Uri.parse(pdfUri), "r")
          ?: throw IllegalArgumentException("Could not open the selected PDF")
        descriptor.use { parcel ->
          PdfRenderer(parcel).use { renderer ->
            if (renderer.pageCount == 0) throw IllegalArgumentException("The PDF has no pages")
            val pageCount = minOf(renderer.pageCount, MAX_PAGES)
            val paths = ArrayList<String>(pageCount)
            for (index in 0 until pageCount) {
              renderer.openPage(index).use { page ->
                val scale = minOf(MAX_WIDTH.toFloat() / page.width, 2f)
                val width = (page.width * scale).toInt().coerceAtLeast(1)
                val height = (page.height * scale).toInt().coerceAtLeast(1)
                val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
                try {
                  val matrix = Matrix().apply { setScale(scale, scale) }
                  page.render(bitmap, null, matrix, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
                  val file = File(context.cacheDir, "invoice-${UUID.randomUUID()}-$index.png")
                  file.outputStream().use { output ->
                    if (!bitmap.compress(Bitmap.CompressFormat.PNG, 100, output)) {
                      throw IllegalStateException("Could not render PDF page ${index + 1}")
                    }
                  }
                  paths.add(Uri.fromFile(file).toString())
                } finally {
                  bitmap.recycle()
                }
              }
            }
            paths
          }
        }
      }
    }
  }

  private companion object {
    const val MAX_PAGES = 5
    const val MAX_WIDTH = 1600
  }
}
