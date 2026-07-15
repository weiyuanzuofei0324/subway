import json
import time
import random
import requests
from bs4 import BeautifulSoup

# 1. 读取你本地已经爬好的、带“首末班车时刻表”的旧 JSON 文件
try:
    with open("wuhan_metro_timetable.json", "r", encoding="utf-8") as f:
        old_data = json.load(f)
except FileNotFoundError:
    print("未找到 wuhan_metro_timetable.json，请确保该文件在当前目录下。")
    old_data = []

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept-Language": "zh-CN,zh;q=0.9"
}

print(f"检测到已抓取数据 {len(old_data)} 条，开始修补 station_title...")

for i, item in enumerate(old_data):
    url = item.get("url")
    if not url:
        continue
        
    try:
        # 重新请求该站点（仅提取 h1 站名，速度极快）
        response = requests.get(url, headers=headers, timeout=10)
        if response.status_code == 200:
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # 🎯 核心修正：定位 class 含有 display-5 的 h1 标签
            h1_tag = soup.find('h1', class_='display-5')
            if h1_tag:
                # h1_tag.contents[0] 只会提取出第一层文本（如“径河”），自动过滤掉里面的 <small>（英文名）
                station_title = h1_tag.contents[0].strip()
                
                # 直接覆盖旧数据的字段
                item["station_title"] = station_title
                print(f"[{i+1}/{len(old_data)}] 成功更新: {station_title}")
            else:
                print(f"[{i+1}/{len(old_data)}] 警告: 未找到 h1 标签 {url}")
        else:
            print(f"[{i+1}/{len(old_data)}] 请求失败，状态码: {response.status_code}")
            
    except Exception as e:
        print(f"[{i+1}/{len(old_data)}] 更新出错: {e}")
        
    # 轻微延时，安全第一
    time.sleep(random.uniform(0.3, 0.8))

# 2. 覆盖保存回本地原文件
with open("wuhan_metro_timetable.json", "w", encoding="utf-8") as f:
    json.dump(old_data, f, ensure_ascii=False, indent=2)

print("🎉 所有站点的 station_title 已全部修正并原地覆盖！")