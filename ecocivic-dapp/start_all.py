# -*- coding: utf-8 -*-
"""
EcoCivic DApp - Tüm Servisleri Başlat
Bu script tüm servisleri otomatik başlatır:
- Hardhat Local Node (Blockchain)
- Backend AI (Flask API)
- Frontend (Vite Dev Server)
"""
import subprocess
import sys
import os
import time
import webbrowser
from pathlib import Path

# Proje kök dizini
PROJECT_ROOT = Path(__file__).parent
SMART_CONTRACTS_DIR = PROJECT_ROOT / "smart-contracts"
BACKEND_DIR = PROJECT_ROOT / "backend-ai"
FRONTEND_DIR = PROJECT_ROOT / "frontend"

def print_banner():
    print("""
╔═══════════════════════════════════════════════════════════╗
║           🏛️ EcoCivic DApp - Servis Başlatıcı              ║
╠═══════════════════════════════════════════════════════════╣
║  Bu script 3 servisi paralel olarak başlatır:             ║
║  1. Hardhat Node    → http://127.0.0.1:8545              ║
║  2. Backend API     → http://localhost:8000              ║
║  3. Frontend        → http://localhost:3000              ║
╚═══════════════════════════════════════════════════════════╝
    """)

def start_hardhat():
    """Hardhat local blockchain node başlat"""
    print("🔗 [1/3] Hardhat Node başlatılıyor...")
    return subprocess.Popen(
        ["npx", "hardhat", "node"],
        cwd=SMART_CONTRACTS_DIR,
        shell=True,
        creationflags=subprocess.CREATE_NEW_CONSOLE if sys.platform == "win32" else 0
    )

def start_backend():
    """Flask backend başlat"""
    print("🖥️ [2/3] Backend API başlatılıyor...")
    return subprocess.Popen(
        [sys.executable, "app.py"],
        cwd=BACKEND_DIR,
        shell=True,
        creationflags=subprocess.CREATE_NEW_CONSOLE if sys.platform == "win32" else 0
    )

def start_frontend():
    """Vite frontend başlat"""
    print("🌐 [3/3] Frontend başlatılıyor...")
    return subprocess.Popen(
        ["npm", "run", "dev"],
        cwd=FRONTEND_DIR,
        shell=True,
        creationflags=subprocess.CREATE_NEW_CONSOLE if sys.platform == "win32" else 0
    )

def seed_database():
    """Veritabanını test verileriyle doldur"""
    print("🌱 Veritabanı seed ediliyor...")
    result = subprocess.run(
        [sys.executable, "-c", "from database.seed_data import seed_all; seed_all()"],
        cwd=BACKEND_DIR,
        capture_output=True,
        text=True
    )
    if result.returncode == 0:
        print("✅ Seed tamamlandı!")
    else:
        print(f"⚠️ Seed uyarısı: {result.stderr[:200] if result.stderr else 'Bilinmeyen hata'}")

def main():
    print_banner()
    
    # Seed database (opsiyonel)
    seed_input = input("📊 Veritabanını yeniden seed etmek ister misiniz? (e/h): ").lower()
    if seed_input == 'e':
        seed_database()
    
    print("\n" + "="*60)
    print("🚀 Servisler başlatılıyor...")
    print("="*60 + "\n")
    
    # Servisleri başlat
    processes = []
    
    try:
        # 1. Hardhat Node
        hardhat_proc = start_hardhat()
        processes.append(("Hardhat", hardhat_proc))
        time.sleep(3)  # Node'un başlamasını bekle
        
        # 2. Backend
        backend_proc = start_backend()
        processes.append(("Backend", backend_proc))
        time.sleep(2)
        
        # 3. Frontend
        frontend_proc = start_frontend()
        processes.append(("Frontend", frontend_proc))
        time.sleep(3)
        
        print("\n" + "="*60)
        print("✅ TÜM SERVİSLER BAŞLATILDI!")
        print("="*60)
        print("""
📍 Servis Adresleri:
   • Hardhat Node:  http://127.0.0.1:8545
   • Backend API:   http://localhost:8000
   • Frontend:      http://localhost:3000

🦊 MetaMask Ayarları:
   • Ağ Adı:    Hardhat Local
   • RPC URL:   http://127.0.0.1:8545
   • Chain ID:  31337
   • Symbol:    ETH

🧪 Test Kullanıcıları:
   • Vatandaş 1:  0xCitizen00100000000000000000000000000001
   • Vatandaş 2:  0xCitizen00200000000000000000000000000002
   • Admin:       0xAdmin00100000000000000000000000000000001
   • Personel:    0xStaff00100000000000000000000000000000001
        """)
        
        # Tarayıcıyı aç
        open_browser = input("\n🌐 Tarayıcıda Frontend'i açmak ister misiniz? (e/h): ").lower()
        if open_browser == 'e':
            webbrowser.open("http://localhost:3000")
        
        print("\n⚠️ Servisleri durdurmak için her terminal penceresini kapatın.")
        print("   veya CTRL+C ile bu script'i durdurun.\n")
        
        # Bekle (CTRL+C ile çıkılacak)
        input("🔄 Servisleri kapatmak için ENTER'a basın...")
        
    except KeyboardInterrupt:
        print("\n\n🛑 Servisler durduruluyor...")
    finally:
        # Tüm süreçleri kapat
        for name, proc in processes:
            try:
                proc.terminate()
                print(f"   ✓ {name} durduruldu")
            except:
                pass
        print("\n👋 Güle güle!")

if __name__ == "__main__":
    main()
