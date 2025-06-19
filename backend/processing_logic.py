# backend/processing_logic.py

import os
import whisper
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from datetime import datetime
import gc
import torch

# --- Global Settings ---
BRAND_COLORS = ["#FF0000", "#00A2FF", "#FFC000"]
# Ensure you have a fallback font or a way to include this font in your deployment environment.
# For a Docker container, you would need to install this font.
FONT_FALLBACKS = ["impact.ttf", "arialbd.ttf", "BebasNeue-Regular.ttf"]
MODEL_SIZE = "base"

# --- Whisper Model Management ---

def load_whisper_model():
    """Loads the Whisper model with memory optimizations."""
    print("Loading Whisper model...")
    # Environment variables for memory optimization
    os.environ["OMP_NUM_THREADS"] = "1"
    os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"
    
    try:
        # Load model with optimizations
        # Using "cpu" device is safer for general-purpose servers without guaranteed GPU.
        model = whisper.load_model(MODEL_SIZE, device="cpu")
        model.eval()
        if hasattr(model, 'encoder'):
            for param in model.encoder.parameters():
                param.requires_grad = False
        print("Whisper model loaded successfully.")
        return model
    except Exception as e:
        print(f"Fatal error loading Whisper model: {e}")
        # In a real app, you might want to raise this to be caught by the API.
        return None

def transcribe_video(model, video_path, language):
    """Transcribes a video file and returns the transcript."""
    if not model:
        raise Exception("Whisper model is not loaded.")
    
    print(f"Starting transcription for {video_path}...")
    try:
        # Transcribe with memory optimizations
        result = model.transcribe(
            video_path,
            language=language,
            fp16=False,  # Force FP32 on CPU
            verbose=False,
            task="transcribe",
            without_timestamps=True
        )
        transcript = result.get("text", "").strip()
        print("Transcription complete.")
        return transcript
    except Exception as e:
        print(f"Error during transcription: {e}")
        raise # Re-raise the exception to be handled by the API

# --- Content Generation ---

def generate_title(transcript):
    """Generates a video title from the transcript."""
    # Simple logic: take the first sensible chunk of text.
    # In a real app, you might use a LLM for this.
    title = transcript[:80].strip()
    if len(transcript) > 80:
        title += "..."
    return title

def generate_description(transcript):
    """Generates a video description from the transcript."""
    timestamp = datetime.now().strftime("%Y-%m-%d")
    return f"""📽️ Video Content - {timestamp}

In this video, we cover:
{transcript[:250]}...

🔔 Subscribe for more content!
📱 Follow me on Instagram: @yourchannel
👍 Like and share if you enjoyed this!

#contentcreator #youtube #vlogging"""

# --- Thumbnail Generation ---

def extract_best_frames(video_path, num_frames=3):
    """Extracts the best frames from a video based on sharpness and face detection."""
    print("Extracting best frames...")
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise Exception("Could not open video file for frame extraction.")
        
    frame_qualities = []
    fps = cap.get(cv2.CAP_PROP_FPS)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    
    # Avoid intros/outros by sampling from the middle 80% of the video
    start_frame = int(total_frames * 0.1)
    end_frame = int(total_frames * 0.9)
    
    # Face detection classifier (ensure the haarcascade file is available)
    # In a Docker container, you might need to specify the full path.
    face_cascade_path = os.path.join(cv2.data.haarcascades, 'haarcascade_frontalface_default.xml')
    if not os.path.exists(face_cascade_path):
        raise FileNotFoundError(f"Haar Cascade file not found at {face_cascade_path}")
    face_cascade = cv2.CascadeClassifier(face_cascade_path)
    
    # Sample frames at intervals
    frame_interval = max(1, (end_frame - start_frame) // (num_frames * 5)) # Sample more frames than needed
    
    for frame_idx in range(start_frame, end_frame, frame_interval):
        cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
        ret, frame = cap.read()
        if not ret:
            continue
            
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        
        # Quality metric 1: Sharpness (Laplacian variance)
        sharpness = cv2.Laplacian(gray, cv2.CV_64F).var()
        
        # Quality metric 2: Face detection bonus
        faces = face_cascade.detectMultiScale(gray, 1.1, 4)
        face_bonus = len(faces) * 500  # Give a significant bonus for finding faces
        
        total_quality = sharpness + face_bonus
        frame_qualities.append({'quality': total_quality, 'frame': frame, 'has_face': len(faces) > 0})
    
    cap.release()
    
    if not frame_qualities:
        raise Exception("Could not extract any frames from the video.")

    # Sort by quality and select the best ones
    frame_qualities.sort(key=lambda x: x['quality'], reverse=True)
    
    best_frames = [fq['frame'] for fq in frame_qualities[:num_frames]]
    has_faces = any(fq['has_face'] for fq in frame_qualities[:num_frames])

    print(f"Extracted {len(best_frames)} best frames.")
    return best_frames, has_faces


def create_professional_thumbnail(frame, title_text, cta_text, font_size, has_faces):
    """Creates a professional-looking thumbnail from a single video frame."""
    frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    img = Image.fromarray(frame_rgb).resize((1280, 720), Image.LANCZOS)
    
    thumbnail = img.copy()
    draw = ImageDraw.Draw(thumbnail, 'RGBA')

    # Load fonts
    font_title, font_cta = None, None
    for font_name in FONT_FALLBACKS:
        try:
            font_title = ImageFont.truetype(font_name, int(font_size * 1.2))
            font_cta = ImageFont.truetype(font_name, font_size)
            break
        except IOError:
            continue
    if not font_title:
        font_title = ImageFont.load_default()
        font_cta = ImageFont.load_default()

    # Add gradient overlay for better text readability
    gradient = Image.new('L', (1, thumbnail.height), color=0xFF)
    for y in range(thumbnail.height):
        gradient.putpixel((0, y), int(255 * (1 - y / thumbnail.height) * 0.8)) # Fade from top to bottom
    alpha = gradient.resize(thumbnail.size)
    black_overlay = Image.new('RGBA', thumbnail.size, color=(0,0,0,150)) # semi-transparent black
    thumbnail.paste(black_overlay, mask=alpha)


    # --- TEXT DRAWING ---
    # Title Text (Top Center)
    # Simple word wrap
    words = title_text.split()
    lines = []
    current_line = ""
    for word in words:
        if len(current_line) + len(word) < 20: # Character limit per line
            current_line += f" {word}"
        else:
            lines.append(current_line.strip())
            current_line = word
    lines.append(current_line.strip())
    
    y_position = 60
    for line in lines:
        draw_text_with_outline(draw, (thumbnail.width/2, y_position), line, font_title, "white", "black", "mt")
        y_position += font_title.getsize(line)[1] + 10


    # Call-to-Action Text (Bottom Left)
    brand_color = BRAND_COLORS[0]
    draw_text_with_outline(draw, (60, thumbnail.height - 80), cta_text, font_cta, brand_color, "black", "ls")

    return thumbnail.convert('RGB')

def draw_text_with_outline(draw, position, text, font, fill, outline, anchor, outline_width=5):
    """Draws text with a solid outline."""
    x, y = position
    # Draw outline
    draw.text((x-outline_width, y), text, font=font, fill=outline, anchor=anchor)
    draw.text((x+outline_width, y), text, font=font, fill=outline, anchor=anchor)
    draw.text((x, y-outline_width), text, font=font, fill=outline, anchor=anchor)
    draw.text((x, y+outline_width), text, font=font, fill=outline, anchor=anchor)
    # Draw main text
    draw.text((x, y), text, font=font, fill=fill, anchor=anchor)

# --- Main Processing Function ---

def process_video_fully(video_path, language="en"):
    """
    Main function to run the full pipeline.
    Loads model, transcribes, generates content, creates thumbnails, and cleans up.
    """
    model = None
    try:
        model = load_whisper_model()
        
        # 1. Transcription
        transcript = transcribe_video(model, video_path, language)
        if not transcript:
            raise Exception("Transcription returned no text.")

        # 2. Content Generation
        title = generate_title(transcript)
        description = generate_description(transcript)
        
        # 3. Thumbnail Generation
        frames, has_faces = extract_best_frames(video_path)
        
        # Use a short version of the title for the thumbnail
        thumbnail_title = title[:25] + "..." if len(title) > 25 else title
        cta_text = "WATCH NOW!"
        font_size = 70
        
        generated_thumbnails = []
        for frame in frames:
            thumb = create_professional_thumbnail(frame, thumbnail_title, cta_text, font_size, has_faces)
            generated_thumbnails.append(thumb)
            
        return {
            "title": title,
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