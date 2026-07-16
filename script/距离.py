import requests
from bs4 import BeautifulSoup
import json

# 🎯 目标页面：英文维基百科武汉地铁车站列表页（包含最规整的站间距、累计距离与换乘表）
URL = "https://en.wikipedia.org/wiki/List_of_Wuhan_Metro_stations"
headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

def clean_distance(val):
    """清洗距离数据，去除引用号 [1]、横杠等，转换为 float"""
    val = val.strip().replace("—", "0").replace("-", "0")
    if not val:
        return 0.0
    try:
        if "[" in val:
            val = val.split("[")[0]
        return float(val)
    except ValueError:
        return 0.0

def parse_wikipedia_subway():
    print("正在连接维基百科获取站间距数据（可能需要挂梯子）...")
    try:
        res = requests.get(URL, headers=headers, timeout=15)
    except Exception as e:
        print(f"连接失败: {e}。请确保已开启科学网络。")
        return
        
    if res.status_code != 200:
        print(f"请求失败，状态码: {res.status_code}")
        return
        
    soup = BeautifulSoup(res.text, 'html.parser')
    
    # 1. 找到所有线网表格
    tables = soup.find_all('table', class_='wikitable')
    
    # 2. 找到所有 H3/H4 级别的线路标题
    headlines = soup.find_all('span', class_='mw-headline')
    
    # 过滤出真正的地铁线路标题
    line_names = []
    for hl in headlines:
        text = hl.text.strip()
        if "Line" in text or "Yangluo" in text:
            line_names.append(text)
            
    # 备用容错：如果标题配对失败，使用标准线路名
    if len(line_names) < len(tables):
        line_names = ["1号线", "2号线", "3号线", "4号线", "5号线", "6号线", "7号线", "8号线", "11号线", "12号线", "16号线", "19号线", "阳逻线"]
        
    subway_data = []
    
    for idx, table in enumerate(tables):
        if idx >= len(line_names):
            break
            
        raw_line_name = line_names[idx]
        # 统一格式化为中文线路名方便入库
        line_name = raw_line_name.replace("Line ", "").replace("Line", "") + "号线"
        if "Yangluo" in raw_line_name:
            line_name = "阳逻线"
            
        print(f"正在提取: {line_name} 站间距与里程...")
        
        stations = []
        rows = table.find_all('tr')[1:]  # 略过表头
        
        seq = 1
        for row in rows:
            cols = row.find_all(['td', 'th'])
            if len(cols) < 5:
                continue
                
            # 维基百科的标准列排序
            name_zh = cols[0].text.strip()
            name_en = cols[1].text.strip()
            inter_dist = clean_distance(cols[2].text.strip())
            acc_dist = clean_distance(cols[3].text.strip())
            district = cols[4].text.strip()
            
            # 解析换乘线路
            transfers_raw = cols[5].text.strip() if len(cols) > 5 else ""
            transfers = []
            if transfers_raw and "—" not in transfers_raw:
                # 维基百科上换乘是用中间点 • 隔开的
                for part in transfers_raw.split("•"):
                    part_cleaned = part.strip().replace("Line ", "") + "号线"
                    if "Yangluo" in part:
                        part_cleaned = "阳逻线"
                    if part_cleaned and "号线" in part_cleaned:
                        transfers.append(part_cleaned)
            
            stations.append({
                "sequence": seq,
                "name": name_zh,
                "name_en": name_en,
                "inter_distance_km": inter_dist,
                "accumulated_distance_km": acc_dist,
                "district": district,
                "transfers": transfers
            })
            seq += 1
            
        subway_data.append({
            "line_name": line_name,
            "stations": stations
        })
        
    # 保存为干净的、可用于数据库初始化的种子 JSON 文件
    with open("wuhan_metro_distances.json", "w", encoding="utf-8") as f:
        json.dump(subway_data, f, ensure_ascii=False, indent=2)
        
    print("\n🎉 数据抓取成功！已保存至本地: wuhan_metro_distances.json")

if __name__ == "__main__":
    parse_wikipedia_subway()
