Pod::Spec.new do |s|
  s.name           = 'CherryInvoiceReader'
  s.version        = '1.0.0'
  s.summary        = 'Render invoice PDF pages for on-device OCR.'
  s.description    = 'Uses PDFKit to render local PDF invoice pages into cache images for OCR.'
  s.license        = { :type => 'MIT' }
  s.author         = 'Cherry'
  s.platform       = :ios, '15.1'
  s.swift_version  = '5.9'
  s.source         = { :git => 'https://github.com/Xenia-Richnakova/Cherry.git', :branch => 'main' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = '**/*.{h,m,mm,swift}'
end
