# backend/processing_logic.py

import os
import whisper
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from datetime import datetime
import gc
import torch
import json

# Import the requests library to make HTTP requests to the LLM API
# You'll need to install it: pip install requests
import requests


# --- Global Settings ---
BRAND_COLORS = ["#FF0000", "#00A2FF", "#FFC000"]
FONT_FALLBACKS = ["impact.ttf", "arialbd.ttf", "BebasNeue-Regular.ttf"] 
MODEL_SIZE = "base"
# IMPORTANT: You would need to get a real API key from a service like Google AI Studio
# and ideally store it securely (e.g., in an environment variable), not hardcoded.
# For this example, we will leave it blank as per instructions.
GEMINI_API_KEY = "AIzaSyC-oWQJWU5ZV7tX9_NBfu4RyWOCvxQVX2U"


# --- AI Content Generation (The New Feature) ---

def generate_creative_content_with_llm(transcript):
    """
    Uses the Gemini LLM to generate multiple titles and a description.
    """
    print("Generating creative content with LLM...")
    
    # This is the prompt we send to the AI. It's carefully crafted to get the best results.
    prompt = f"""
    Based on the following video transcript, please act as a YouTube content expert. 
    Your task is to generate a list of 5 creative, catchy, and SEO-friendly titles.
    Also, write one engaging video description that includes relevant hashtags.

    The titles should be engaging and make people want to click.
    The description should summarize the video's content in an exciting way.

    Please provide the output in a JSON object with two keys: "titles" (a list of strings) and "description" (a single string).

    Transcript:
    ---
    {transcript[:2000]} 
    ---
    """

    # As per instructions, structure the payload for the Gemini API
    payload = {
        "contents": [{
            "parts": [{
                "text": prompt
            }]
        }]
    }
    
    headers = {
        'Content-Type': 'application/json'
    }
    
    # Use the specified Gemini Flash model URL
    api_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key={GEMINI_API_KEY}"
    
    try:
        # Make the API call
        response = requests.post(api_url, headers=headers, data=json.dumps(payload))
        response.raise_for_status()  # This will raise an exception for bad status codes (4xx or 5xx)
        
        # Extract the text content from the response
        result_json_str = response.json()['candidates'][0]['content']['parts'][0]['text']
        
        # Clean up the string in case the model wraps it in markdown backticks
        if result_json_str.startswith("```json"):
            result_json_str = result_json_str[7:-4]

        # Parse the JSON string into a Python dictionary
        content_data = json.loads(result_json_str)

        print("LLM content generated successfully.")
        return content_data['titles'], content_data['description']
        
    except requests.exceptions.RequestException as e:
        print(f"Error calling LLM API: {e}")
        # Fallback to the old, simple method if the API fails
        return [generate_title(transcript)], generate_description(transcript)
    except (KeyError, IndexError, json.JSONDecodeError) as e:
        print(f"Error parsing LLM response: {e}")
        # Fallback if the response format is unexpected
        return [generate_title(transcript)], generate_description(transcript)


# --- Basic Content Generation (Fallback Functions) ---

def generate_title(transcript):
    """Generates a basic video title from the transcript."""
    title = transcript[:80].strip()
    if len(transcript) > 80:
        title += "..."
    return title

def generate_description(transcript):
    """Generates a basic video description from the transcript."""
    timestamp = datetime.now().strftime("%Y-%m-%d")
    return f"""📽️ Video Content - {timestamp}\n\nIn this video, we cover:\n{transcript[:250]}...\n\n🔔 Subscribe for more content!\n📱 Follow me on Instagram: @yourchannel\n👍 Like and share if you enjoyed this!\n\n#contentcreator #youtube #vlogging"""


# --- Main Processing Function (Updated) ---

def process_video_fully(video_path, language="en"):
    """
    Main function to run the full pipeline.
    """
    model = None
    try:
        model = load_whisper_model()
        
        # 1. Transcription
        transcript = transcribe_video(model, video_path, language)
        if not transcript:
            raise Exception("Transcription returned no text.")

        # 2. NEW: AI Content Generation
        titles, description = generate_creative_content_with_llm(transcript)
        
        # 3. Thumbnail Generation
        frames, has_faces = extract_best_frames(video_path)
        
        # Use the first generated title as the default for thumbnails
        thumbnail_title = titles[0][:25] + "..." if len(titles[0]) > 25 else titles[0]
        cta_text = "WATCH NOW!"
        font_size = 70
        
        generated_thumbnails = []
        for frame in frames:
            thumb = create_professional_thumbnail(frame, thumbnail_title, cta_text, font_size, has_faces)
            generated_thumbnails.append(thumb)
            
        return {
            "titles": titles, # Now returns a list of titles
            "description": description,
            "transcript": transcript,
            "thumbnails": generated_thumbnails
        }

    finally:
        # 4. Cleanup
        if model:
            del model
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
        gc.collect()
        print("Cleanup complete.")

# --- The rest of the file (load_whisper_model, transcribe_video, extract_best_frames, etc.) remains the same ---
# (Full code for brevity, no changes below this line except what's shown above)

def load_whisper_model():
    print("Loading Whisper model...")
    os.environ["OMP_NUM_THREADS"] = "1"; os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"
    try:
        model = whisper.load_model(MODEL_SIZE, device="cpu"); model.eval()
        if hasattr(model, 'encoder'):
            for param in model.encoder.parameters(): param.requires_grad = False
        print("Whisper model loaded successfully."); return model
    except Exception as e:
        print(f"Fatal error loading Whisper model: {e}"); return None

def transcribe_video(model, video_path, language):
    if not model: raise Exception("Whisper model is not loaded.")
    print(f"Starting transcription for {video_path}...")
    try:
        result = model.transcribe(video_path, language=language, fp16=False, verbose=False, task="transcribe", without_timestamps=True)
        transcript = result.get("text", "").strip(); print("Transcription complete."); return transcript
    except Exception as e:
        print(f"Error during transcription: {e}"); raise

def extract_best_frames(video_path, num_frames=3):
    print("Extracting best frames...")
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened(): raise Exception("Could not open video file for frame extraction.")
    frame_qualities = []; total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    start_frame = int(total_frames * 0.1); end_frame = int(total_frames * 0.9)
    face_cascade_path = os.path.join(cv2.data.haarcascades, 'haarcascade_frontalface_default.xml')
    if not os.path.exists(face_cascade_path): raise FileNotFoundError(f"Haar Cascade file not found at {face_cascade_path}")
    face_cascade = cv2.CascadeClassifier(face_cascade_path)
    frame_interval = max(1, (end_frame - start_frame) // (num_frames * 5))
    for frame_idx in range(start_frame, end_frame, frame_interval):
        cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx); ret, frame = cap.read()
        if not ret: continue
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        sharpness = cv2.Laplacian(gray, cv2.CV_64F).var()
        faces = face_cascade.detectMultiScale(gray, 1.1, 4)
        face_bonus = len(faces) * 500
        total_quality = sharpness + face_bonus
        frame_qualities.append({'quality': total_quality, 'frame': frame, 'has_face': len(faces) > 0})
    cap.release()
    if not frame_qualities: raise Exception("Could not extract any frames from the video.")
    frame_qualities.sort(key=lambda x: x['quality'], reverse=True)
    best_frames = [fq['frame'] for fq in frame_qualities[:num_frames]]
    has_faces = any(fq['has_face'] for fq in frame_qualities[:num_frames])
    print(f"Extracted {len(best_frames)} best frames."); return best_frames, has_faces

def create_professional_thumbnail(frame, title_text, cta_text, font_size, has_faces):
    frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    img = Image.fromarray(frame_rgb).resize((1280, 720), Image.LANCZOS)
    thumbnail = img.copy(); draw = ImageDraw.Draw(thumbnail, 'RGBA')
    font_title, font_cta = None, None
    for font_name in FONT_FALLBACKS:
        try:
            font_title = ImageFont.truetype(font_name, int(font_size * 1.2)); font_cta = ImageFont.truetype(font_name, font_size); break
        except IOError: continue
    if not font_title: font_title = ImageFont.load_default(); font_cta = ImageFont.load_default()
    gradient = Image.new('L', (1, thumbnail.height), color=0xFF)
    for y in range(thumbnail.height): gradient.putpixel((0, y), int(255 * (1 - y / thumbnail.height) * 0.8))
    alpha = gradient.resize(thumbnail.size)
    black_overlay = Image.new('RGBA', thumbnail.size, color=(0,0,0,150)); thumbnail.paste(black_overlay, mask=alpha)
    words = title_text.split(); lines = []; current_line = ""
    for word in words:
        if len(current_line) + len(word) < 20: current_line += f" {word}"
        else: lines.append(current_line.strip()); current_line = word
    lines.append(current_line.strip())
    y_position = 60
    for line in lines:
        draw_text_with_outline(draw, (thumbnail.width/2, y_position), line, font_title, "white", "black", "mt")
        bbox = font_title.getbbox(line); line_height = bbox[3] - bbox[1]; y_position += line_height + 10
    brand_color = BRAND_COLORS[0]
    draw_text_with_outline(draw, (60, thumbnail.height - 80), cta_text, font_cta, brand_color, "black", "ls")
    return thumbnail.convert('RGB')

def draw_text_with_outline(draw, position, text, font, fill, outline, anchor, outline_width=5):
    x, y = position
    draw.text((x-outline_width, y), text, font=font, fill=outline, anchor=anchor)
    draw.text((x+outline_width, y), text, font=font, fill=outline, anchor=anchor)
    draw.text((x, y-outline_width), text, font=font, fill=outline, anchor=anchor)
    draw.text((x, y+outline_width), text, font=font, fill=outline, anchor=anchor)
    draw.text((x, y), text, font=font, fill=fill, anchor=anchor)
