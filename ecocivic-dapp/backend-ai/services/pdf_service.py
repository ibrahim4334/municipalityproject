import os
from datetime import datetime
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# Font kaydı (Türkçe karakterler için)
# Sistemde Arial varsa onu kullanabiliriz, yoksa default font ile devam
try:
    # Bu path Windows için genellenebilir veya proje içine font dosyası eklenebilir
    # Şimdilik standart font kullanalım, Türkçe karakter sorunu olursa düzeltiriz
    pass
except:
    pass

class PDFService:
    def __init__(self, upload_folder="uploads"):
        self.upload_folder = upload_folder
        self.pdfs_dir = os.path.join(upload_folder, "invoices")
        os.makedirs(self.pdfs_dir, exist_ok=True)

    def generate_water_bill(self, reading_data: dict) -> str:
        """
        Su faturası PDF'i oluştur
        Returns: PDF dosyasının adı
        """
        filename = f"water_bill_{reading_data['meter_no']}_{int(datetime.now().timestamp())}.pdf"
        filepath = os.path.join(self.pdfs_dir, filename)
        
        c = canvas.Canvas(filepath, pagesize=A4)
        width, height = A4
        
        # Header
        c.setFont("Helvetica-Bold", 24)
        c.drawString(20 * mm, height - 30 * mm, "EcoCivic Su Faturasi")
        
        c.setFont("Helvetica", 12)
        c.drawString(20 * mm, height - 40 * mm, f"Tarih: {datetime.now().strftime('%d.%m.%Y %H:%M')}")
        c.drawString(20 * mm, height - 45 * mm, f"Abone/Sayac No: {reading_data['meter_no']}")
        c.drawString(20 * mm, height - 50 * mm, f"Cuzdan: {reading_data['wallet_address']}")
        
        # Çizgi
        c.line(20 * mm, height - 60 * mm, width - 20 * mm, height - 60 * mm)
        
        # Detaylar
        y = height - 80 * mm
        c.setFont("Helvetica-Bold", 14)
        c.drawString(20 * mm, y, "Fatura Detaylari")
        
        y -= 15 * mm
        c.setFont("Helvetica", 12)
        c.drawString(20 * mm, y, f"Son Endeks: {reading_data['current_index']} m3")
        y -= 10 * mm
        c.drawString(20 * mm, y, f"Ilk Endeks: {reading_data['previous_index']} m3")
        y -= 10 * mm
        c.drawString(20 * mm, y, f"Tuketim: {reading_data['consumption_m3']} m3")
        
        y -= 20 * mm
        c.setFont("Helvetica-Bold", 14)
        c.drawString(20 * mm, y, "Ucretlendirme (Birim Fiyat: 10 TL/m3)")
        
        y -= 15 * mm
        c.setFont("Helvetica-Bold", 16)
        c.drawString(20 * mm, y, f"TOPLAM TUTAR: {reading_data['bill_amount']} TL")
        
        # Footer
        c.setFont("Helvetica", 10)
        c.drawString(20 * mm, 30 * mm, "EcoCivic Belediyesi Akilli Kent Sistemleri")
        c.drawString(20 * mm, 25 * mm, "Bu belge elektronik olarak uretilmistir.")
        
        c.save()
        
        return filename

pdf_service = PDFService()
