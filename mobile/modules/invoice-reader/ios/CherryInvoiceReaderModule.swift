import ExpoModulesCore
import PDFKit
import UIKit

public final class CherryInvoiceReaderModule: Module {
  public func definition() -> ModuleDefinition {
    Name("CherryInvoiceReader")

    AsyncFunction("renderPdfPages") { (pdfUri: String) -> [String] in
      guard let url = URL(string: pdfUri), let document = PDFDocument(url: url) else {
        throw NSError(domain: "CherryInvoiceReader", code: 1, userInfo: [NSLocalizedDescriptionKey: "Could not open the selected PDF"])
      }
      guard document.pageCount > 0 else {
        throw NSError(domain: "CherryInvoiceReader", code: 2, userInfo: [NSLocalizedDescriptionKey: "The PDF has no pages"])
      }

      let cacheDirectory = FileManager.default.temporaryDirectory
      var renderedPages: [String] = []
      for index in 0..<min(document.pageCount, 5) {
        guard let page = document.page(at: index) else { continue }
        let bounds = page.bounds(for: .mediaBox)
        let scale = min(1600 / max(bounds.width, 1), 2)
        let size = CGSize(width: bounds.width * scale, height: bounds.height * scale)
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        let image = UIGraphicsImageRenderer(size: size, format: format).image { rendererContext in
          rendererContext.cgContext.translateBy(x: 0, y: size.height)
          rendererContext.cgContext.scaleBy(x: scale, y: -scale)
          page.draw(with: .mediaBox, to: rendererContext.cgContext)
        }
        guard let png = image.pngData() else {
          throw NSError(domain: "CherryInvoiceReader", code: 3, userInfo: [NSLocalizedDescriptionKey: "Could not render PDF page \(index + 1)"])
        }
        let file = cacheDirectory.appendingPathComponent("invoice-\(UUID().uuidString)-\(index).png")
        try png.write(to: file, options: .atomic)
        renderedPages.append(file.absoluteString)
      }
      return renderedPages
    }
  }
}
