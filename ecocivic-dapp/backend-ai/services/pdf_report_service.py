"""
PDF Report Generator
Fiziksel kontrol ve denetim raporları için PDF export
"""
import logging
from typing import Dict, List, Optional
from datetime import datetime
from io import BytesIO
import base64

logger = logging.getLogger("pdf-report")

# Check for reportlab
try:
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import cm, mm
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image
    from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
    REPORTLAB_AVAILABLE = True
except ImportError:
    REPORTLAB_AVAILABLE = False
    logger.warning("reportlab not available. PDF generation disabled.")


class InspectionReportGenerator:
    """
    Fiziksel kontrol raporu PDF generator
    """
    
    def __init__(self):
        if REPORTLAB_AVAILABLE:
            self.styles = getSampleStyleSheet()
            self._setup_custom_styles()
    
    def _setup_custom_styles(self):
        """Custom styles"""
        self.styles.add(ParagraphStyle(
            name='ReportTitle',
            parent=self.styles['Heading1'],
            fontSize=18,
            alignment=TA_CENTER,
            spaceAfter=30
        ))
        self.styles.add(ParagraphStyle(
            name='SectionHeader',
            parent=self.styles['Heading2'],
            fontSize=14,
            spaceAfter=12
        ))
        self.styles.add(ParagraphStyle(
            name='BodyTextTR',
            parent=self.styles['Normal'],
            fontSize=10,
            leading=14
        ))
    
    def generate_inspection_report(
        self,
        inspection_data: Dict,
        user_data: Dict,
        risk_score: Optional[Dict] = None
    ) -> bytes:
        """
        Fiziksel kontrol raporu oluştur
        
        Args:
            inspection_data: {
                inspection_id: int,
                scheduled_date: str,
                completed_date: str,
                inspector_name: str,
                inspector_wallet: str,
                reported_reading: int,
                actual_reading: int,
                fraud_found: bool,
                notes: str
            }
            user_data: {
                wallet_address: str,
                meter_no: str,
                address: str,
                name: str
            }
            risk_score: Risk score card data
            
        Returns:
            PDF bytes
        """
        if not REPORTLAB_AVAILABLE:
            raise RuntimeError("reportlab not installed. Run: pip install reportlab")
        
        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=2*cm,
            leftMargin=2*cm,
            topMargin=2*cm,
            bottomMargin=2*cm
        )
        
        story = []
        
        # Title
        story.append(Paragraph("SU SAYACI FİZİKSEL KONTROL RAPORU", self.styles['ReportTitle']))
        story.append(Spacer(1, 20))
        
        # Report metadata
        report_date = datetime.now().strftime("%d.%m.%Y %H:%M")
        story.append(Paragraph(f"<b>Rapor Tarihi:</b> {report_date}", self.styles['BodyTextTR']))
        story.append(Paragraph(f"<b>Rapor No:</b> INSP-{inspection_data.get('inspection_id', 'N/A')}", self.styles['BodyTextTR']))
        story.append(Spacer(1, 20))
        
        # User Info Section
        story.append(Paragraph("KULLANICI BİLGİLERİ", self.styles['SectionHeader']))
        user_table_data = [
            ["Cüzdan Adresi", user_data.get("wallet_address", "N/A")[:20] + "..."],
            ["Sayaç Numarası", user_data.get("meter_no", "N/A")],
            ["İsim", user_data.get("name", "N/A")],
            ["Adres", user_data.get("address", "N/A")]
        ]
        user_table = Table(user_table_data, colWidths=[5*cm, 10*cm])
        user_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, -1), colors.lightgrey),
            ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        story.append(user_table)
        story.append(Spacer(1, 20))
        
        # Inspection Details
        story.append(Paragraph("KONTROL DETAYLARI", self.styles['SectionHeader']))
        
        fraud_status = "FRAUD TESPİT EDİLDİ" if inspection_data.get("fraud_found") else "FRAUD TESPİT EDİLMEDİ"
        fraud_color = colors.red if inspection_data.get("fraud_found") else colors.green
        
        insp_table_data = [
            ["Planlanan Tarih", inspection_data.get("scheduled_date", "N/A")],
            ["Kontrol Tarihi", inspection_data.get("completed_date", "N/A")],
            ["Kontrolör", inspection_data.get("inspector_name", "N/A")],
            ["Kontrolör Cüzdanı", inspection_data.get("inspector_wallet", "N/A")[:20] + "..."],
            ["Bildirilen Okuma", f"{inspection_data.get('reported_reading', 0):,} m³"],
            ["Gerçek Okuma", f"{inspection_data.get('actual_reading', 0):,} m³"],
            ["Fark", f"{inspection_data.get('actual_reading', 0) - inspection_data.get('reported_reading', 0):,} m³"],
            ["Sonuç", fraud_status]
        ]
        
        insp_table = Table(insp_table_data, colWidths=[5*cm, 10*cm])
        insp_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, -1), colors.lightgrey),
            ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
            ('TEXTCOLOR', (1, -1), (1, -1), fraud_color),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTNAME', (1, -1), (1, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        story.append(insp_table)
        story.append(Spacer(1, 20))
        
        # Notes
        if inspection_data.get("notes"):
            story.append(Paragraph("NOTLAR", self.styles['SectionHeader']))
            story.append(Paragraph(inspection_data.get("notes", ""), self.styles['BodyTextTR']))
            story.append(Spacer(1, 20))
        
        # Risk Score Card (if available)
        if risk_score:
            story.append(Paragraph("RİSK SKOR KARTI", self.styles['SectionHeader']))
            
            risk_table_data = [
                ["Genel Skor", f"{risk_score.get('overall_score', 0)}/100"],
                ["Risk Seviyesi", risk_score.get("risk_level", "N/A").upper()],
                ["Öneri", risk_score.get("recommendation", "N/A")]
            ]
            
            risk_table = Table(risk_table_data, colWidths=[5*cm, 10*cm])
            risk_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (0, -1), colors.lightgrey),
                ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 10),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
                ('TOPPADDING', (0, 0), (-1, -1), 8),
                ('GRID', (0, 0), (-1, -1), 1, colors.black)
            ]))
            story.append(risk_table)
            story.append(Spacer(1, 20))
        
        # Signature area
        story.append(Spacer(1, 40))
        story.append(Paragraph("İMZA", self.styles['SectionHeader']))
        
        sig_table_data = [
            ["Kontrolör İmzası", "", "Yetkili İmzası", ""],
        ]
        sig_table = Table(sig_table_data, colWidths=[4*cm, 4*cm, 4*cm, 4*cm])
        sig_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 40),
            ('LINEBELOW', (1, 0), (1, 0), 1, colors.black),
            ('LINEBELOW', (3, 0), (3, 0), 1, colors.black),
        ]))
        story.append(sig_table)
        
        # Build PDF
        doc.build(story)
        
        return buffer.getvalue()
    
    def generate_comparison_report(
        self,
        user_data: Dict,
        readings: List[Dict],
        period_months: int = 12
    ) -> bytes:
        """
        Sayaç karşılaştırma raporu
        
        Args:
            user_data: User info
            readings: [{month, reported, actual, difference}, ...]
            period_months: Report period
            
        Returns:
            PDF bytes
        """
        if not REPORTLAB_AVAILABLE:
            raise RuntimeError("reportlab not installed")
        
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4)
        
        story = []
        
        # Title
        story.append(Paragraph("SAYAÇ OKUMA KARŞILAŞTIRMA RAPORU", self.styles['ReportTitle']))
        story.append(Paragraph(f"Dönem: Son {period_months} Ay", self.styles['BodyTextTR']))
        story.append(Spacer(1, 20))
        
        # User info
        story.append(Paragraph(f"<b>Sayaç No:</b> {user_data.get('meter_no', 'N/A')}", self.styles['BodyTextTR']))
        story.append(Paragraph(f"<b>Cüzdan:</b> {user_data.get('wallet_address', 'N/A')[:20]}...", self.styles['BodyTextTR']))
        story.append(Spacer(1, 20))
        
        # Readings table
        if readings:
            story.append(Paragraph("OKUMA TABLOSU", self.styles['SectionHeader']))
            
            table_data = [["Ay", "Bildirilen", "Gerçek", "Fark", "Fark %"]]
            
            total_diff = 0
            for r in readings:
                diff = r.get("actual", 0) - r.get("reported", 0)
                diff_pct = (diff / r.get("reported", 1) * 100) if r.get("reported", 0) > 0 else 0
                total_diff += diff
                
                table_data.append([
                    r.get("month", ""),
                    f"{r.get('reported', 0):,}",
                    f"{r.get('actual', 0):,}",
                    f"{diff:,}",
                    f"{diff_pct:.1f}%"
                ])
            
            # Total row
            table_data.append(["TOPLAM", "", "", f"{total_diff:,}", ""])
            
            table = Table(table_data, colWidths=[3*cm, 3*cm, 3*cm, 3*cm, 3*cm])
            table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
                ('BACKGROUND', (0, -1), (-1, -1), colors.lightgrey),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 9),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                ('TOPPADDING', (0, 0), (-1, -1), 6),
                ('GRID', (0, 0), (-1, -1), 1, colors.black)
            ]))
            story.append(table)
        
        doc.build(story)
        return buffer.getvalue()
    
    def to_base64(self, pdf_bytes: bytes) -> str:
        """Convert PDF bytes to base64 string"""
        return base64.b64encode(pdf_bytes).decode('utf-8')


# Global instance
report_generator = InspectionReportGenerator()
