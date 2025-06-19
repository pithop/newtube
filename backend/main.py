# backend/main.py

import os
import uuid
import shutil
from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import base64
from io import BytesIO

# Import the core logic from your refactored script
import processing_logic

# --- FastAPI App Initialization ---

app = FastAPI(
    title="Creator Assistant API",
    description="An API to automate YouTube content creation tasks.",
    version="1.0.0"
)

# --- CORS Middleware ---
# This allows your frontend (running on a different domain) to communicate with this API.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict this to your frontend's domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Temporary Storage Configuration ---
# Create a directory to temporarily store uploaded videos.
UPLOAD_DIR = "temp_uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# --- API Endpoints ---

@app.get("/", summary="Root Endpoint", description="A simple hello world endpoint to check if the API is running.")
def read_root():
    """A simple endpoint to confirm the API is running."""
    return {"message": "Welcome to the Creator Assistant API!"}


@app.post("/process-video/", summary="Process Video", description="Upload a video to transcribe, generate content, and create thumbnails.")
async def process_video_endpoint(
    video_file: UploadFile = File(...), 
    language: str = Form("en")
):
    """
    Handles video upload and processing.
    
    - **video_file**: The video file to be processed.
    - **language**: The language of the video (e.g., 'en', 'es'). 'None' for auto-detect.
    """
    
    # --- 1. Save Uploaded File Temporarily ---
    # Generate a unique filename to avoid conflicts
    unique_id = uuid.uuid4()
    file_extension = os.path.splitext(video_file.filename)[1]
    temp_video_path = os.path.join(UPLOAD_DIR, f"{unique_id}{file_extension}")
    
    try:
        # Save the uploaded video file to the temporary path
        with open(temp_video_path, "wb") as buffer:
            shutil.copyfileobj(video_file.file, buffer)
        print(f"Video saved temporarily to {temp_video_path}")

        # --- 2. Run the Full Processing Pipeline ---
        # This is a blocking call. For a real SaaS, you would make this asynchronous
        # using a task queue like Celery or ARQ.
        results = processing_logic.process_video_fully(temp_video_path, language)

        # --- 3. Encode Thumbnails for JSON Response ---
        # The generated thumbnails are PIL Image objects. We need to convert them
        # to a format that can be sent over JSON, like Base64.
        encoded_thumbnails = []
        for thumb in results["thumbnails"]:
            buffered = BytesIO()
            thumb.save(buffered, format="PNG")
            img_str = base64.b64encode(buffered.getvalue()).decode("utf-8")
            encoded_thumbnails.append(f"data:image/png;base64,{img_str}")

        # Update the results dictionary with the encoded images
        results["thumbnails"] = encoded_thumbnails
        
        print("Processing successful. Sending results.")
        return JSONResponse(content=results)

    except Exception as e:
        # If any error occurs during processing, return an HTTP error.
        print(f"An error occurred: {e}")
        raise HTTPException(
            status_code=500, 
            detail=f"An error occurred during video processing: {str(e)}"
        )
        
    finally:
        # --- 4. Cleanup ---
        # Ensure the temporary file is deleted after processing,
        # whether it was successful or not.
        if os.path.exists(temp_video_path):
            os.remove(temp_video_path)
            print(f"Cleaned up temporary file: {temp_video_path}")
        # Clean up the entire directory if it's empty
        if not os.listdir(UPLOAD_DIR):
            os.rmdir(UPLOAD_DIR)

# --- How to Run This App ---
# 1. Make sure you have FastAPI and Uvicorn installed:
#    pip install fastapi "uvicorn[standard]"
# 2. Run the server from your terminal:
#    uvicorn main:app --reload
#
# The API will be available at http://127.0.0.1:8000
# You can see the interactive API documentation at http://127.0.0.1:8000/docs