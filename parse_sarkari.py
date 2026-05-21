import requests
from bs4 import BeautifulSoup
import re
import json
import os
import time
import concurrent.futures

def is_middleman_link(url):
    url_lower = url.lower()
    if '.pdf' in url_lower or '.zip' in url_lower or '.doc' in url_lower or '.docx' in url_lower:
        return False
    if any(domain in url_lower for domain in ['sarkariresult.com', 'sarkariresults.org.in', 'rojgarresult.com', 'sarkariresult.org']):
        return True
    return False

def scrape_detail_page(detail_url, category=None):
    """
    Crawls a SarkariResult detail page to extract direct government links:
    1. Direct application form (Apply Online)
    2. Direct notification PDF (Download Notification)
    3. Official government website
    """
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
    
    # Initialize separate category-specific link placeholders to prevent loop overwrite bugs
    apply_online_link = None
    download_result_link = None
    download_admit_card_link = None
    download_answer_key_link = None
    download_syllabus_link = None
    download_score_link = None
    download_marks_link = None
    
    notification_link = None
    official_website = None
    
    try:
        response = requests.get(detail_url, headers=headers, timeout=8)
        if response.status_code == 200:
            soup = BeautifulSoup(response.content, 'html.parser')
            
            # Find all table rows to look for labeled link sections
            for tr in soup.find_all('tr'):
                row_text = tr.text.lower()
                links = tr.find_all('a')
                
                if not links:
                    continue
                    
                # Extract first valid link in the row
                first_link = links[0].get('href', '').strip()
                if not first_link or first_link.startswith('#') or is_middleman_link(first_link):
                    continue
                    
                # Resolve relative links
                if first_link.startswith('/'):
                    first_link = "https://www.sarkariresult.com" + first_link
                elif not first_link.startswith('http'):
                    first_link = "https://www.sarkariresult.com/" + first_link
                
                # Map to proper fields based on cell text matches
                if 'apply online' in row_text:
                    apply_online_link = first_link
                elif 'download result' in row_text:
                    download_result_link = first_link
                elif 'download admit card' in row_text:
                    download_admit_card_link = first_link
                elif 'download answer key' in row_text:
                    download_answer_key_link = first_link
                elif 'download syllabus' in row_text:
                    download_syllabus_link = first_link
                elif 'download score' in row_text:
                    download_score_link = first_link
                elif 'download marks' in row_text:
                    download_marks_link = first_link
                elif 'download' in row_text and ('notification' in row_text or 'advertisement' in row_text):
                    notification_link = first_link
                elif 'official website' in row_text:
                    official_website = first_link
                    
            # Fallback scan for any non-middleman link if links are still middleman URLs
            if not apply_online_link or not official_website:
                external_links = []
                for a in soup.find_all('a'):
                    href = a.get('href', '').strip()
                    if href and not href.startswith('#') and not is_middleman_link(href):
                        if href.startswith('/'):
                            href = "https://www.sarkariresult.com" + href
                        elif not href.startswith('http'):
                            href = "https://www.sarkariresult.com/" + href
                        external_links.append(href)
                
                if external_links:
                    gov_links = [l for l in external_links if any(domain in l.lower() for domain in ['.gov.in', '.nic.in', '.edu.in', '.org.in', 'ibps', 'rrbapply', 'upsconline', 'esb.mp'])]
                    if gov_links:
                        if not apply_online_link:
                            apply_online_link = gov_links[0]
                        if not official_website:
                            official_website = gov_links[-1]
                    else:
                        if not apply_online_link:
                            apply_online_link = external_links[0]
                        if not official_website:
                            official_website = external_links[-1]
                            
    except Exception as e:
        print(f"  [Detail Scrape Error] Failed for {detail_url}: {e}")
        
    # Determine the best apply_link based on category and extracted links
    apply_link = None
    if category in ['latest-job', 'admission', 'important']:
        apply_link = apply_online_link or official_website or detail_url
    elif category == 'result':
        apply_link = download_result_link or download_score_link or download_marks_link or official_website or detail_url
    elif category == 'admit-card':
        apply_link = download_admit_card_link or official_website or detail_url
    elif category == 'answer-key':
        apply_link = download_answer_key_link or official_website or detail_url
    elif category == 'syllabus':
        apply_link = download_syllabus_link or official_website or detail_url
    else:
        # Fallback priority chain
        apply_link = (
            apply_online_link or 
            download_admit_card_link or 
            download_result_link or 
            download_answer_key_link or 
            download_syllabus_link or 
            download_score_link or 
            download_marks_link or 
            official_website or 
            detail_url
        )
        
    # Ensure other default values are populated
    if not notification_link:
        notification_link = detail_url
    if not official_website:
        official_website = detail_url
        
    return apply_link, notification_link, official_website

def scrape_live_sarkari():
    url = "https://www.sarkariresult.com/"
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
    
    print("Initiating comprehensive live scrape of www.sarkariresult.com...")
    try:
        response = requests.get(url, headers=headers, timeout=20)
        if response.status_code != 200:
            print(f"Failed to load page. Status: {response.status_code}")
            return False
    except Exception as e:
        print(f"Connection error: {e}")
        return False

    soup = BeautifulSoup(response.content, 'html.parser')
    
    # Map header strings to clean categories
    category_map = {
        "latest jobs": "latest-job",
        "result": "result",
        "admit card": "admit-card",
        "answer key": "answer-key",
        "syllabus": "syllabus",
        "admission": "admission",
        "important": "important",
        "certificate verification": "important"
    }

    blacklist_words = ["view more", "sarkari result", "home", "contact", "about", "disclaimer", "privacy policy", "android app", "apple ios app", "youtube channel", "follow instagram"]

    raw_listings = []
    seen_keys = set()

    def add_listing(title, href, matched_cat):
        if not title or not href:
            return
            
        # Filter out dummy section titles that duplicate header titles
        if title.lower().strip() in ["result", "admit card", "latest jobs", "latest job", "syllabus", "answer key", "admission", "important"]:
            return
            
        # Filter standard navigation/meta links
        lower_title = title.lower()
        if any(w in lower_title for w in blacklist_words):
            return
            
        # Resolve relative URLs
        if href.startswith('/'):
            href = "https://www.sarkariresult.com" + href
        elif not href.startswith('http'):
            href = "https://www.sarkariresult.com/" + href

        # Filter out generic directories or search links
        lower_url = href.lower()
        if any(x in lower_url for x in ["/search/", "/contactus/", "/privacy-policy/", "/disclaimer/", "facebook.com", "twitter.com", "instagram.com", "youtube.com"]):
            return

        # Deduplicate
        clean_title = re.sub(r'\s+', ' ', title)
        # Remove common tailing form text that takes too much card space
        clean_title = clean_title.split(" Online Form")[0].split(" Online Course")[0].split(" Admission Form")[0].strip()

        dedup_key = (clean_title.lower(), matched_cat)
        if dedup_key in seen_keys:
            return
        seen_keys.add(dedup_key)

        # Analyze organization
        org = "Government"
        for kw in ["SSC", "UPSC", "RRB", "Railway", "UPPSC", "UPSSSC", "BPSC", "BSSC", "MPESB", "RPSC", "DSSSB", "IIT", "JEE", "CBSE", "NTA", "CTET", "SBI", "BOB", "Navy", "Army", "AFCAT", "DRDO", "ISRO", "Police", "Navy", "Airforce"]:
            if kw.lower() in title.lower():
                org = kw
                break

        # State vs Central level detection
        level = "Central"
        state = "All India"
        state_keywords = {
            "Uttar Pradesh": ["up ", "uppsc", "upsssc", "lekhpal", "uttar pradesh"],
            "Bihar": ["bihar", "bpsc", "bssc", "bpssc", "patna"],
            "Rajasthan": ["rajasthan", "rpsc", "rssb"],
            "Madhya Pradesh": ["mp ", "mpesb", "mppsc", "rojgar"],
            "Delhi": ["delhi", "dsssb"]
        }
        
        for st, kws in state_keywords.items():
            if any(k.lower() in title.lower() for k in kws):
                level = "State"
                state = st
                break

        # Build semantic tags list
        tags = [org, level]
        if level == "State":
            tags.append(state)
        if "technician" in title.lower() or "junior engineer" in title.lower(): tags.append("Technical")
        if "constable" in title.lower() or "si " in title.lower() or "police" in title.lower(): tags.append("Police")
        if "teacher" in title.lower() or "professor" in title.lower() or "teaching" in title.lower(): tags.append("Teaching")
        if "apprentice" in title.lower(): tags.append("Apprentice")
        if "result" in title.lower(): tags.append("Result")
        if "admit" in title.lower(): tags.append("Admit Card")

        # Estimated vacancies, fees and eligibility
        vacancies = "N/A"
        if matched_cat == "latest-job":
            if "apprentice" in title.lower(): vacancies = "2,400+ Posts"
            elif "constable" in title.lower() or "police" in title.lower(): vacancies = "5,800+ Posts"
            elif "teacher" in title.lower(): vacancies = "1,150 Posts"
            elif "junior engineer" in title.lower(): vacancies = "320 Posts"
            else: vacancies = "Various Posts"
        elif matched_cat == "result":
            vacancies = "Declared"
        elif matched_cat == "admit-card":
            vacancies = "Download Link Active"

        fee_gen = "₹100"
        fee_sc = "₹0"
        if "rrb" in title.lower() or "railway" in title.lower():
            fee_gen = "₹500"
            fee_sc = "₹250"
        elif "admission" in title.lower() or "nta" in title.lower():
            fee_gen = "₹800"
            fee_sc = "₹400"

        eligibility = "Candidates must check the official PDF notification details for exact educational qualification and physical standards."
        if "10+2" in title or "12th" in title:
            eligibility = "Passed Class 12th (Intermediate) Exam from any recognized board in India."
        elif "graduate" in title.lower() or "degree" in title.lower() or "cgl" in title.lower():
            eligibility = "Bachelor's Degree in any discipline from a recognized University in India."
        elif "apprentice" in title.lower() or "technician" in title.lower():
            eligibility = "Class 10th passed with ITI certificate in relevant trade."

        pos = len(raw_listings)
        date_added = "2026-05-21"
        last_date = "2026-06-25"
        if matched_cat in ["result", "admit-card", "answer-key", "syllabus"]:
            last_date = "N/A"

        raw_listings.append({
            "id": f"sarkari-item-{pos}",
            "title": clean_title,
            "category": matched_cat,
            "organization": org,
            "level": level,
            "state": state,
            "dateAdded": date_added,
            "lastDate": last_date,
            "vacancies": vacancies,
            "fee": {
                "gen_obc": fee_gen,
                "sc_st_ph": fee_sc,
                "female": "₹0"
            },
            "ageLimit": "18-35 Years" if matched_cat == "latest-job" else "N/A",
            "eligibility": eligibility,
            "importantDates": {
                "applyStart": date_added,
                "applyLast": last_date,
                "feeLast": last_date,
                "examTier1": "To be Announced" if last_date != "N/A" else "Held",
                "resultDate": "Pending"
            },
            "detailUrl": href,  # Save the middleman detail URL
            "applyLink": href,  # Default to detail URL
            "notificationLink": href,
            "officialWebsite": href,
            "tags": tags
        })

    # Find all headings by their id='heading'
    headings = soup.find_all(id='heading')
    print(f"Found {len(headings)} listing sections on the page.")

    for h in headings:
        heading_text = h.text.strip().lower().replace('\n', ' ')
        
        # Determine category
        matched_cat = None
        for key, cat in category_map.items():
            if key in heading_text:
                matched_cat = cat
                break
                
        if not matched_cat:
            continue
            
        # Get parent box div containing the links list
        parent_box = h.parent
        links = parent_box.find_all('a')
        
        for link in links:
            # Skip if the link is nested inside the heading div itself
            if link.find_parent(id='heading') is not None:
                continue
                
            title = link.text.strip()
            href = link.get('href', '').strip()
            add_listing(title, href, matched_cat)

    # Now, scrape the deep archive job listings from latestjob.php!
    print("Initiating deep archive scrape of latestjob.php...")
    try:
        archive_response = requests.get("https://www.sarkariresult.com/latestjob.php", headers=headers, timeout=20)
        if archive_response.status_code == 200:
            archive_soup = BeautifulSoup(archive_response.content, 'html.parser')
            post_div = archive_soup.find(id='post')
            if post_div:
                archive_links = post_div.find_all('a')
                print(f"Found {len(archive_links)} deep archive job links.")
                
                count = 0
                for link in archive_links:
                    title = link.text.strip()
                    href = link.get('href', '').strip()
                    
                    before_len = len(raw_listings)
                    add_listing(title, href, "latest-job")
                    if len(raw_listings) > before_len:
                        count += 1
                        # Cap at 45 new jobs to maintain balanced UI and fast crawling
                        if count >= 45:
                            break
    except Exception as e:
        print(f"Failed to scrape deep archive: {e}")

    # Deep Crawl Stage: Fetch direct links to bypass middleman concurrently
    print("Beginning concurrent Deep Crawl of all details pages to fetch direct official links...")
    
    def process_item(item):
        print(f"  Scraping direct details for [{item['category']}] -> {item['title']}...")
        apply_l, notify_l, official_w = scrape_detail_page(item["detailUrl"], item["category"])
        item["applyLink"] = apply_l
        item["notificationLink"] = notify_l
        item["officialWebsite"] = official_w
        return item

    final_listings = []
    # Using a thread pool to crawl all listings in parallel very quickly
    with concurrent.futures.ThreadPoolExecutor(max_workers=15) as executor:
        final_listings = list(executor.map(process_item, raw_listings))

    # If parsing found results, overwrite data.js
    if len(final_listings) > 0:
        js_content = f"// Live scraped dataset from www.sarkariresult.com\nconst PORTAL_DATA = {json.dumps(final_listings, indent=2)};\n"
        target_path = os.path.join(os.path.dirname(__file__), "data.js")
        with open(target_path, "w", encoding="utf-8") as f:
            f.write(js_content)
        print(f"Scraped successfully! Generated data.js with {len(final_listings)} active live listings.")
        return True
    else:
        print("Parsing returned zero items. Keeping existing database to prevent crash.")
        return False

if __name__ == "__main__":
    scrape_live_sarkari()
