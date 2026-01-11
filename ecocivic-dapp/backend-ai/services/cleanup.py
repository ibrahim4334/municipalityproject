import os
import time
import logging
from datetime import datetime, timedelta

logger = logging.getLogger("cleanup-job")

def cleanup_old_files(upload_folder: str, max_age_days: int = 180):
    """
    Belirtilen klasördeki eski dosyaları siler.
    
    Args:
        upload_folder: Temizlenecek klasör yolu
        max_age_days: Dosyaların saklanacağı maksimum gün sayısı (Varsayılan: 6 ay / 180 gün)
    """
    try:
        if not os.path.exists(upload_folder):
            logger.warning(f"Upload folder {upload_folder} does not exist, skipping cleanup.")
            return

        logger.info(f"Starting cleanup job for {upload_folder}. Max age: {max_age_days} days.")
        
        # Saniye cinsinden saklama süresi
        max_age_seconds = max_age_days * 86400
        current_time = time.time()
        
        deleted_count = 0
        deleted_size = 0
        
        for filename in os.listdir(upload_folder):
            file_path = os.path.join(upload_folder, filename)
            
            # Sadece dosyaları işle
            if not os.path.isfile(file_path):
                continue
                
            # Dosya yaşını kontrol et
            file_age = current_time - os.path.getmtime(file_path)
            
            if file_age > max_age_seconds:
                try:
                    file_size = os.path.getsize(file_path)
                    os.remove(file_path)
                    deleted_count += 1
                    deleted_size += file_size
                    logger.debug(f"Deleted old file: {filename}")
                except Exception as e:
                    logger.error(f"Failed to delete {filename}: {e}")
                    
        if deleted_count > 0:
            logger.info(f"Cleanup completed. Deleted {deleted_count} files ({deleted_size / 1024:.2f} KB).")
        else:
            logger.info("Cleanup completed. No files deleted.")
            
    except Exception as e:
        logger.error(f"Error during cleanup job: {e}")
