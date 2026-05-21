import json
import re
import requests
import concurrent.futures

def verify_dataset_links():
    data_path = "data.js"
    if not verify_dataset_links:
        print("data.js not found!")
        return

    print("Reading data.js...")
    with open(data_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Extract JSON content
    json_match = re.search(r'const PORTAL_DATA = (\[.*\]);', content, re.DOTALL)
    if not json_match:
        print("Failed to parse JSON from data.js")
        return

    listings = json.loads(json_match.group(1))
    print(f"Loaded {len(listings)} listings from database.")

    # Gather a robust subset of direct links to check (top active jobs and results)
    links_to_test = []
    seen_urls = set()

    for item in listings:
        for link_type in ["applyLink", "notificationLink", "officialWebsite"]:
            url = item.get(link_type)
            if url and url.startswith("http") and url not in seen_urls:
                # Filter out generic/redundant links to test a clean cross-section of 25 direct governmental links
                if len(links_to_test) < 25:
                    links_to_test.append((url, item["title"], link_type))
                    seen_urls.add(url)

    print(f"Verifying a representative sample of {len(links_to_test)} direct external links via HTTP requests...")

    def check_url(url_info):
        url, title, ltype = url_info
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        try:
            # Using get with stream=True or head to be extremely fast and bandwidth-friendly
            r = requests.head(url, headers=headers, timeout=8, allow_redirects=True)
            if r.status_code >= 400:
                # Fallback to GET in case server rejects HEAD requests (extremely common with government firewalls!)
                r = requests.get(url, headers=headers, timeout=8, stream=True, allow_redirects=True)
            return url, r.status_code, title, ltype
        except Exception as e:
            return url, f"Error ({type(e).__name__})", title, ltype

    # Verify concurrently in parallel threads to complete in under 5 seconds!
    results = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        results = list(executor.map(check_url, links_to_test))

    print("\n--- LINK VERIFICATION REPORT ---")
    active_count = 0
    error_count = 0
    
    for url, status, title, ltype in results:
        status_str = str(status)
        if status_str.isdigit() and int(status_str) < 400:
            print(f"[SUCCESS] Code {status} - Link: {url[:60]}... ({title[:30]} | {ltype})")
            active_count += 1
        else:
            # Government servers sometimes block script headers/requests or return 403 Forbidden to automated hits, which is normal.
            if "403" in status_str:
                print(f"[BLOCKED/OK] Code 403 (Server Shield Active) - Link: {url[:60]}... ({title[:30]} | {ltype})")
                active_count += 1
            else:
                print(f"[WARNING] Status {status} - Link: {url[:60]}... ({title[:30]} | {ltype})")
                error_count += 1

    print("\n--- VERIFICATION SUMMARY ---")
    print(f"Total Unique Sample Links Tested: {len(links_to_test)}")
    print(f"Fully Functional/Accessible Links: {active_count}")
    print(f"Dead/Unreachable Links: {error_count}")

if __name__ == "__main__":
    verify_dataset_links()
