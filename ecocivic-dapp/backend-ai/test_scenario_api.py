import requests
import json
import os

# State'i resetle (Local'de çalışıyorsa)
if os.path.exists("demo_state.json"):
    os.remove("demo_state.json")

url = "http://localhost:8000/api/water/validate"
# Backend'deki varsayılan test cüzdanı veya herhangi biri
user_address = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" 

def test_request(step):
    print(f"\n========== TEST {step} ==========")
    # Rastgele bir resim verisi (Mock modda resim içeriği önemsiz)
    files = {'image': ('meter.jpg', b'\xFF\xD8\xFF\xE0\x00\x10JFIF\x00\x01\x01\x01\x00\x48\x00\x48\x00\x00\xFF\xDB', 'image/jpeg')}
    data = {'user_address': user_address}
    
    try:
        r = requests.post(url, files=files, data=data)
        print(f"Status Code: {r.status_code}")
        try:
            print("Response JSON:", json.dumps(r.json(), indent=2))
        except:
            print("Response Text:", r.text)
    except Exception as e:
        print(f"Request Error: {e}")

# 3 Adım Test
test_request(1) # Beklenen: Normal
test_request(2) # Beklenen: Düşük Tüketim (Warning)
test_request(3) # Beklenen: Anomali (Error/Valid:False)
