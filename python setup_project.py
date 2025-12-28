import os

def create_project_structure():
    # Proje ana dizini
    base_dir = "ecocivic-dapp"

    # Oluşturulacak tüm dosya yolları
    files = [
        # Smart Contracts
        "smart-contracts/contracts/EcoCivicDeposit.sol",
        "smart-contracts/contracts/BELTToken.sol",
        "smart-contracts/contracts/WaterBilling.sol",
        "smart-contracts/contracts/RecyclingRewards.sol",
        "smart-contracts/contracts/SlashingManager.sol",
        "smart-contracts/contracts/interfaces/IAave.sol",
        "smart-contracts/contracts/interfaces/ICompound.sol",
        "smart-contracts/contracts/interfaces/IERC20.sol",
        "smart-contracts/scripts/deploy.js",
        "smart-contracts/scripts/seed.js",
        "smart-contracts/test/deposit.test.js",
        "smart-contracts/test/billing.test.js",
        "smart-contracts/test/slashing.test.js",
        "smart-contracts/hardhat.config.js",
        "smart-contracts/package.json",

        # Frontend
        "frontend/public/index.html",
        "frontend/src/abi/EcoCivicDeposit.json",
        "frontend/src/abi/BELTToken.json",
        "frontend/src/abi/WaterBilling.json",
        "frontend/src/components/WalletConnect.jsx",
        "frontend/src/components/DepositPanel.jsx",
        "frontend/src/components/WaterMeterUpload.jsx",
        "frontend/src/components/RecyclingQR.jsx",
        "frontend/src/components/RewardsDashboard.jsx",
        "frontend/src/components/PenaltyStatus.jsx",
        "frontend/src/pages/Home.jsx",
        "frontend/src/pages/Water.jsx",
        "frontend/src/pages/Recycling.jsx",
        "frontend/src/pages/Dashboard.jsx",
        "frontend/src/services/web3.js",
        "frontend/src/services/api.js",
        "frontend/src/services/contracts.js",
        "frontend/src/context/Web3Context.jsx",
        "frontend/src/App.jsx",
        "frontend/src/main.jsx",
        "frontend/package.json",

        # Backend AI
        "backend-ai/app.py",
        "backend-ai/requirements.txt",
        "backend-ai/ai/ocr.py",
        "backend-ai/ai/anomaly_detection.py",
        "backend-ai/ai/model_utils.py",
        "backend-ai/services/water_validation.py",
        "backend-ai/services/recycling_validation.py",
        "backend-ai/services/qr_service.py",
        "backend-ai/database/models.py",
        "backend-ai/database/db.py",
        "backend-ai/config.py",

        # Docs & Root
        "docs/architecture.md",
        "docs/tokenomics.md",
        "docs/api-spec.md",
        "README.md",
        ".gitignore"
    ]

    print(f"--- {base_dir} Projesi Olusturuluyor ---")

    for file_path in files:
        # Tam dosya yolunu oluştur
        full_path = os.path.join(base_dir, file_path)
        
        # Klasör yapısını ayıkla ve oluştur
        directory = os.path.dirname(full_path)
        if not os.path.exists(directory):
            os.makedirs(directory)
            print(f"Klasör olusturuldu: {directory}")

        # Dosyayı boş olarak oluştur
        if not os.path.exists(full_path):
            with open(full_path, "w", encoding="utf-8") as f:
                f.write(f"// {os.path.basename(file_path)} dosyasi") # Başlangıç yorumu
            print(f"Dosya olusturuldu: {full_path}")

    print("\n[BASARILI] Proje iskeleti hazır!")

if __name__ == "__main__":
    create_project_structure()