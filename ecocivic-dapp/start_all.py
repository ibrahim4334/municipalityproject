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
+-----------------------------------------------------------+
|           EcoCivic DApp - Servis Baslatici                |
+-----------------------------------------------------------+
|  Bu script 3 servisi paralel olarak baslatir:             |
|  1. Hardhat Node    -> http://127.0.0.1:8545              |
|  2. Backend API     -> http://localhost:8000              |
|  3. Frontend        -> http://localhost:3000              |
+-----------------------------------------------------------+
    """)

def start_hardhat():
    """Hardhat local blockchain node baslat"""
    print("[1/3] Hardhat Node baslatiliyor...")
    return subprocess.Popen(
        ["npx", "hardhat", "node"],
        cwd=SMART_CONTRACTS_DIR,
        shell=True,
        creationflags=subprocess.CREATE_NEW_CONSOLE if sys.platform == "win32" else 0
    )

def start_backend():
    """Flask backend baslat"""
    print("[2/3] Backend API baslatiliyor...")
    return subprocess.Popen(
        [sys.executable, "app.py"],
        cwd=BACKEND_DIR,
        shell=True,
        creationflags=subprocess.CREATE_NEW_CONSOLE if sys.platform == "win32" else 0
    )

def start_frontend():
    """Vite frontend baslat"""
    print("[3/3] Frontend baslatiliyor...")
    return subprocess.Popen(
        ["npm", "run", "dev"],
        cwd=FRONTEND_DIR,
        shell=True,
        creationflags=subprocess.CREATE_NEW_CONSOLE if sys.platform == "win32" else 0
    )

def seed_database():
    """Veritabanini test verileriyle doldur"""
    print("[SEED] Veritabani seed ediliyor...")
    result = subprocess.run(
        [sys.executable, "-c", "from database.seed_data import seed_all; seed_all()"],
        cwd=BACKEND_DIR,
        capture_output=True,
        text=True
    )
    if result.returncode == 0:
        print("[OK] Seed tamamlandi!")
    else:
        print(f"[!] Seed uyarisi: {result.stderr[:200] if result.stderr else 'Bilinmeyen hata'}")

def main():
    print_banner()
    
    # Seed database (opsiyonel)
    seed_input = input("Veritabanini yeniden seed etmek ister misiniz? (e/h): ").lower()
    if seed_input == 'e':
        seed_database()
    
    print("\n" + "="*60)
    print("[START] Servisler baslatiliyor...")
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
        print("[OK] TUM SERVISLER BASLATILDI!")
        print("="*60)
        print("""
Servis Adresleri:
   * Hardhat Node:  http://127.0.0.1:8545
   * Backend API:   http://localhost:8000
   * Frontend:      http://localhost:3000

MetaMask Ayarlari:
   * Ag Adi:    Hardhat Local
   * RPC URL:   http://127.0.0.1:8545
   * Chain ID:  31337
   * Symbol:    ETH

Test Kullanicilari:
   * Vatandas 1:  0xCitizen00100000000000000000000000000001
   * Vatandas 2:  0xCitizen00200000000000000000000000000002
   * Admin:       0xAdmin00100000000000000000000000000000001
   * Personel:    0xStaff00100000000000000000000000000000001
        """)
        
        # Tarayiciyi ac
        open_browser = input("\nTarayicida Frontend'i acmak ister misiniz? (e/h): ").lower()
        if open_browser == 'e':
            webbrowser.open("http://localhost:3000")
        
        print("\n[!] Servisleri durdurmak icin her terminal penceresini kapatin.")
        print("   veya CTRL+C ile bu script'i durdurun.\n")
        
        # Bekle (CTRL+C ile cikilacak)
        input("Servisleri kapatmak icin ENTER'a basin...")
        
    except KeyboardInterrupt:
        print("\n\n[STOP] Servisler durduruluyor...")
    finally:
        # Tum surecleri kapat
        for name, proc in processes:
            try:
                proc.terminate()
                print(f"   [OK] {name} durduruldu")
            except:
                pass
        print("\nGule gule!")

if __name__ == "__main__":
    main()
