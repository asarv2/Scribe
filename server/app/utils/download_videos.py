import requests
import re
import subprocess
import os

def get_entry_ids():
    """
    Fetches entry IDs and names from the Kaltura MediaSpace search page.
    """
    # URL of the page containing the Kaltura videos, with pageSize=100 to show all results
    PAGE_URL = "https://mediaspace.itap.purdue.edu/esearch/search?fields=name&sortBy=webcastStartAsc&keyword=ece%2020007&pageSize=100"

    # Fetch the page content
    response = requests.get(PAGE_URL)
    if response.status_code != 200:
        print(f"Failed to fetch the page. Status code: {response.status_code}")
        return {}

    # Extract entry IDs and names using regex
    pattern = r'"id":"(1_[^"]+)","name":"([^"]+)"'
    matches = re.finditer(pattern, response.text)
    
    entry_ids = {}
    for match in matches:
        entry_id = match.group(1)
        name = match.group(2)
        entry_ids[name] = entry_id

    # Print the extracted entry IDs and total count
    print(f"\nFound {len(entry_ids)} entries:")
    for name, entry_id in entry_ids.items():
        print(f"{name}: {entry_id}")

    return entry_ids

def download_video(entry_id, lecture_name, output_dir="server/uploads"):
    """
    Downloads a video from Kaltura MediaSpace using the entry_id.
    The video is saved as an MP4 file in the specified output directory.
    Skips download if the file already exists.
    """
    # Base URL for the .m3u8 HLS stream
    M3U8_URL = f"https://cdnapisec.kaltura.com/p/983291/sp/98329100/playManifest/entryId/{entry_id}/format/applehttp/protocol/https/a.m3u8"

    # Create output directory if it doesn't exist
    os.makedirs(output_dir, exist_ok=True)
    
    # Output file path
    output_file = os.path.join(output_dir, f"{lecture_name}.mp4")

    # Check if file already exists
    if os.path.exists(output_file):
        print(f"\nSkipping {lecture_name} - file already exists at: {output_file}")
        return

    print(f"\nDownloading video for lecture: {lecture_name}")
    print(f"Saving as: {output_file}")

    # Run ffmpeg to download the video
    command = [
        "ffmpeg", "-i", M3U8_URL, "-c", "copy", "-bsf:a", "aac_adtstoasc", output_file
    ]
    
    try:
        subprocess.run(command, check=True)
        print(f"Download complete: {output_file}")
    except subprocess.CalledProcessError as e:
        print(f"Error downloading {entry_id}: {e}")

if __name__ == "__main__":
    entry_ids = get_entry_ids()
    
    if entry_ids:
        # Download all videos (removed the break statement)
        for name, entry_id in entry_ids.items():
            download_video(entry_id, name)
