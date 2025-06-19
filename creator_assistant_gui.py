import os
import whisper
import tkinter as tk
from tkinter import ttk
from tkinter import filedialog, scrolledtext, messagebox
from datetime import datetime
import threading
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageOps, ImageTk, ImageFilter
import tempfile
import shutil
import sys
import gc  # Garbage collector for memory management
import torch  # PyTorch for memory management

class ContentCreatorApp:
    def __init__(self, root):
        self.root = root
        self.root.title("YouTube Content Creator Assistant")
        self.root.geometry("1000x800")
        self.root.protocol("WM_DELETE_WINDOW", self.on_close)  # Handle window closing
        
        # Branding settings
        self.brand_colors = ["#FF0000", "#00A2FF", "#FFC000"]
        self.brand_font = "arialbd.ttf"
        
        # Create UI elements
        self.create_widgets()
        
        # We'll load the Whisper model on demand instead of at startup
        self.model = None
        self.model_lock = threading.Lock()
        
        # Thumbnail variables
        self.generated_thumbnails = []
        self.temp_dir = None
    
    def on_close(self):
        """Clean up resources before closing"""
        if self.temp_dir and os.path.exists(self.temp_dir):
            shutil.rmtree(self.temp_dir)
        if self.model:
            del self.model
            torch.cuda.empty_cache() if torch.cuda.is_available() else None
            gc.collect()
        self.root.destroy()
    
    def create_widgets(self):
        # Video selection
        tk.Label(self.root, text="Select Video File:").pack(pady=5)
        self.file_frame = tk.Frame(self.root)
        self.file_frame.pack(fill=tk.X, padx=10, pady=5)
        
        self.file_entry = tk.Entry(self.file_frame, width=50)
        self.file_entry.pack(side=tk.LEFT, padx=5)
        
        self.browse_btn = tk.Button(self.file_frame, text="Browse", command=self.browse_file)
        self.browse_btn.pack(side=tk.LEFT)
        
        # Language selection
        tk.Label(self.root, text="Video Language:").pack(pady=5)
        self.language_var = tk.StringVar(value="en")
        self.language_frame = tk.Frame(self.root)
        self.language_frame.pack(fill=tk.X, padx=10, pady=5)
        languages = [("English", "en"), ("Auto Detect", None), ("Spanish", "es"), 
                     ("French", "fr"), ("German", "de"), ("Arabic", "ar")]
        for text, lang in languages:
            tk.Radiobutton(self.language_frame, text=text, variable=self.language_var, 
                           value=lang).pack(side=tk.LEFT, padx=5)
        
        # Process button
        self.process_btn = tk.Button(self.root, text="Generate Content", command=self.process_video)
        self.process_btn.pack(pady=10)
        
        # Thumbnail button
        self.thumbnail_btn = tk.Button(
            self.root, 
            text="Generate Thumbnails", 
            command=self.generate_thumbnails,
            state=tk.DISABLED
        )
        self.thumbnail_btn.pack(pady=5)
        
        # Progress label
        self.progress_label = tk.Label(self.root, text="Ready")
        self.progress_label.pack(pady=5)
        
        # Content tabs
        self.notebook = ttk.Notebook(self.root)
        self.notebook.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
        
        # Title tab
        self.title_frame = tk.Frame(self.notebook)
        tk.Label(self.title_frame, text="Title:").pack(anchor='w')
        self.title_text = tk.Text(self.title_frame, height=3)
        self.title_text.pack(fill=tk.X, padx=5, pady=5)
        self.notebook.add(self.title_frame, text="Title")
        
        # Description tab
        self.desc_frame = tk.Frame(self.notebook)
        tk.Label(self.desc_frame, text="Description:").pack(anchor='w')
        self.desc_text = scrolledtext.ScrolledText(self.desc_frame, height=8)
        self.desc_text.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)
        self.notebook.add(self.desc_frame, text="Description")
        
        # Transcript tab
        self.trans_frame = tk.Frame(self.notebook)
        tk.Label(self.trans_frame, text="Transcript:").pack(anchor='w')
        self.trans_text = scrolledtext.ScrolledText(self.trans_frame, height=15)
        self.trans_text.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)
        self.notebook.add(self.trans_frame, text="Transcript")
        
        # Thumbnails tab
        self.thumb_frame = tk.Frame(self.notebook)
        self.notebook.add(self.thumb_frame, text="Thumbnails")
        
        # Thumbnail preview area
        self.thumb_preview_frame = tk.Frame(self.thumb_frame)
        self.thumb_preview_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
        
        # Canvas for thumbnail previews
        self.canvas = tk.Canvas(self.thumb_preview_frame)
        self.scrollbar = ttk.Scrollbar(
            self.thumb_preview_frame, 
            orient="vertical", 
            command=self.canvas.yview
        )
        self.scrollable_frame = ttk.Frame(self.canvas)
        
        self.scrollable_frame.bind(
            "<Configure>",
            lambda e: self.canvas.configure(scrollregion=self.canvas.bbox("all"))
        )
        
        self.canvas.create_window((0, 0), window=self.scrollable_frame, anchor="nw")
        self.canvas.configure(yscrollcommand=self.scrollbar.set)
        
        self.canvas.pack(side="left", fill="both", expand=True)
        self.scrollbar.pack(side="right", fill="y")
        
        # Thumbnail customization
        self.custom_frame = tk.Frame(self.thumb_frame)
        self.custom_frame.pack(fill=tk.X, padx=10, pady=5)
        
        tk.Label(self.custom_frame, text="Thumbnail Text:").pack(side=tk.LEFT, padx=5)
        self.thumb_text_var = tk.StringVar(value="MUST SEE!")
        self.thumb_text_entry = tk.Entry(self.custom_frame, textvariable=self.thumb_text_var, width=30)
        self.thumb_text_entry.pack(side=tk.LEFT, padx=5)
        
        tk.Label(self.custom_frame, text="Font Size:").pack(side=tk.LEFT, padx=5)
        self.font_size_var = tk.IntVar(value=80)
        self.font_size_spin = tk.Spinbox(self.custom_frame, from_=60, to=120, width=5, textvariable=self.font_size_var)
        self.font_size_spin.pack(side=tk.LEFT, padx=5)
        
        self.update_thumb_btn = tk.Button(
            self.custom_frame, 
            text="Update Thumbnails", 
            command=self.update_thumbnails
        )
        self.update_thumb_btn.pack(side=tk.LEFT, padx=10)
        
        # Save thumbnails button
        self.save_thumbs_btn = tk.Button(
            self.thumb_frame, 
            text="Download All Thumbnails", 
            command=self.save_thumbnails,
            state=tk.DISABLED
        )
        self.save_thumbs_btn.pack(pady=10)
        
        # Save content button
        self.save_btn = tk.Button(self.root, text="Save Content", command=self.save_content, state=tk.DISABLED)
        self.save_btn.pack(pady=10)
    
    def browse_file(self):
        file_path = filedialog.askopenfilename(
            title="Select Video File",
            filetypes=[
                ("Video Files", "*.mp4 *.MP4 *.avi *.mov *.mkv *.webm"),
                ("MP4 Files", "*.mp4 *.MP4"),
                ("All Files", "*.*")
            ]
        )
        if file_path:
            self.file_entry.delete(0, tk.END)
            self.file_entry.insert(0, file_path)
    
    def load_whisper_model(self):
        """Load Whisper model with memory optimizations"""
        with self.model_lock:
            if self.model is None:
                # Use the smallest model that gives good results
                model_size = "base"
                
                # Set environment variables for memory optimization
                os.environ["OMP_NUM_THREADS"] = "1"
                os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"
                
                try:
                    # Load model with optimizations
                    self.model = whisper.load_model(model_size, device="cpu")
                    # Reduce memory usage
                    self.model.eval()
                    if hasattr(self.model, 'encoder'):
                        for param in self.model.encoder.parameters():
                            param.requires_grad = False
                    return True
                except Exception as e:
                    messagebox.showerror("Model Error", f"Failed to load Whisper model: {str(e)}")
                    return False
            return True
    
    def unload_whisper_model(self):
        """Unload Whisper model to free memory"""
        with self.model_lock:
            if self.model:
                del self.model
                self.model = None
                torch.cuda.empty_cache() if torch.cuda.is_available() else None
                gc.collect()
    
    def process_video(self):
        file_path = self.file_entry.get()
        
        if not file_path:
            messagebox.showerror("Error", "Please select a video file")
            return
            
        if not os.path.exists(file_path):
            messagebox.showerror("Error", f"File not found:\n{file_path}")
            return
            
        file_size = os.path.getsize(file_path)
        if file_size == 0:
            messagebox.showerror("Error", "The selected file is empty")
            return
            
        valid_extensions = ['.mp4', '.MP4', '.avi', '.mov', '.mkv', '.webm']
        if not any(file_path.endswith(ext) for ext in valid_extensions):
            messagebox.showerror("Error", "Unsupported file format. Please select a video file")
            return

        language = self.language_var.get()
        if language == "None":
            language = None

        self.process_btn.config(state=tk.DISABLED)
        self.browse_btn.config(state=tk.DISABLED)
        self.progress_label.config(text="Processing video... This may take several minutes")
        
        # Use a thread for processing to keep UI responsive
        threading.Thread(target=self.run_processing, args=(file_path, language), daemon=True).start()
    
    def run_processing(self, file_path, language):
        try:
            # Load model just before use
            if not self.load_whisper_model():
                return
                
            self.root.after(0, self.progress_label.config, {"text": "Transcribing video..."})
            
            # Transcribe with memory optimizations
            result = self.model.transcribe(
                file_path, 
                language=language,
                fp16=False,  # Force FP32 on CPU
                verbose=False,  # Reduce output
                task="transcribe",
                without_timestamps=True  # Reduce memory usage
            )
            transcript = result["text"]
            
            # Unload model immediately after use
            self.unload_whisper_model()
            
            self.root.after(0, self.progress_label.config, {"text": "Generating content..."})
            title = self.generate_title(transcript)
            description = self.generate_description(transcript)
            
            self.root.after(0, self.update_results, title, description, transcript)
            self.root.after(0, self.progress_label.config, {"text": "Content generated!"})
            self.root.after(0, self.save_btn.config, {"state": tk.NORMAL})
            self.root.after(0, self.thumbnail_btn.config, {"state": tk.NORMAL})
            
        except Exception as e:
            error_msg = f"Processing failed: {str(e)}"
            if "out of memory" in str(e).lower():
                error_msg += "\n\nTry using a smaller video or upgrading your hardware"
            self.root.after(0, messagebox.showerror, "Error", error_msg)
            self.root.after(0, self.progress_label.config, {"text": "Error occurred"})
        finally:
            self.root.after(0, self.process_btn.config, {"state": tk.NORMAL})
            self.root.after(0, self.browse_btn.config, {"state": tk.NORMAL})
    
    def generate_title(self, transcript):
        # Keep title under 20 characters for thumbnails
        if len(transcript) > 50:
            title = transcript[:50] + "..."
        else:
            title = transcript
            
        # Truncate to 20 characters for thumbnail use
        self.thumbnail_title = title[:20] + ("..." if len(title) > 20 else "")
        return title
    
    def generate_description(self, transcript):
        timestamp = datetime.now().strftime("%Y-%m-%d")
        return f"""📽️ Video Content - {timestamp}

In this video, we cover:
{transcript[:250]}...

🔔 Subscribe for more content!
📱 Follow me on Instagram: @yourchannel
👍 Like and share if you enjoyed this!

#contentcreator #youtube #vlogging"""
    
    def update_results(self, title, description, transcript):
        self.title_text.delete(1.0, tk.END)
        self.title_text.insert(tk.END, title)
        
        self.desc_text.delete(1.0, tk.END)
        self.desc_text.insert(tk.END, description)
        
        self.trans_text.delete(1.0, tk.END)
        self.trans_text.insert(tk.END, transcript)
        
        self.video_title = title
    
    def generate_thumbnails(self):
        file_path = self.file_entry.get()
        if not file_path or not os.path.exists(file_path):
            messagebox.showerror("Error", "Please process a valid video first")
            return
            
        self.thumbnail_btn.config(state=tk.DISABLED)
        self.progress_label.config(text="Generating thumbnails...")
        
        self.temp_dir = tempfile.mkdtemp()
        self.generated_thumbnails = []
        
        threading.Thread(target=self.create_thumbnails, args=(file_path,), daemon=True).start()
    
    def create_thumbnails(self, file_path):
        try:
            frames = self.extract_best_frames(file_path)
            
            for i, frame in enumerate(frames):
                thumbnail = self.create_professional_thumbnail(frame)
                thumb_path = os.path.join(self.temp_dir, f"thumbnail_{i+1}.png")
                thumbnail.save(thumb_path)
                self.generated_thumbnails.append(thumb_path)
            
            self.root.after(0, self.display_thumbnails)
            self.root.after(0, self.progress_label.config, {"text": f"Generated {len(self.generated_thumbnails)} thumbnails!"})
            self.root.after(0, self.save_thumbs_btn.config, {"state": tk.NORMAL})
            
        except Exception as e:
            self.root.after(0, messagebox.showerror, "Thumbnail Error", str(e))
            self.root.after(0, self.progress_label.config, {"text": "Thumbnail generation failed"})
        finally:
            self.root.after(0, self.thumbnail_btn.config, {"state": tk.NORMAL})
    
    def update_thumbnails(self):
        if not self.generated_thumbnails:
            messagebox.showinfo("Info", "Generate thumbnails first")
            return
            
        self.progress_label.config(text="Updating thumbnails...")
        self.thumbnail_btn.config(state=tk.DISABLED)
        
        threading.Thread(target=self.update_thumbnails_thread, daemon=True).start()
    
    def update_thumbnails_thread(self):
        try:
            for i, thumb_path in enumerate(self.generated_thumbnails):
                img = Image.open(thumb_path)
                frame = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)
                new_thumb = self.create_professional_thumbnail(frame)
                new_thumb.save(thumb_path)
            
            self.root.after(0, self.display_thumbnails)
            self.root.after(0, self.progress_label.config, {"text": "Thumbnails updated!"})
        except Exception as e:
            self.root.after(0, messagebox.showerror, "Update Error", str(e))
            self.root.after(0, self.progress_label.config, {"text": "Update failed"})
        finally:
            self.root.after(0, self.thumbnail_btn.config, {"state": tk.NORMAL})
    
    def extract_best_frames(self, video_path, num_frames=5):
        cap = cv2.VideoCapture(video_path)
        frames = []
        frame_qualities = []
        
        if not cap.isOpened():
            raise Exception("Could not open video file")
            
        fps = cap.get(cv2.CAP_PROP_FPS)
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        
        # Skip the first few seconds (often intros)
        start_frame = int(fps * 5)
        
        # Calculate frame interval (sample every 3 seconds)
        frame_interval = max(1, int(fps * 3))
        
        # Face detection classifier
        face_cascade = cv2.CascadeClassifier(
            cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
        )
        
        # Process frames in batches to reduce memory usage
        batch_size = 100
        for batch_start in range(start_frame, total_frames, batch_size * frame_interval):
            frame_batch = []
            
            # Read a batch of frames
            for i in range(batch_size):
                frame_idx = batch_start + i * frame_interval
                if frame_idx >= total_frames:
                    break
                    
                cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
                ret, frame = cap.read()
                if not ret:
                    break
                    
                frame_batch.append((frame_idx, frame))
            
            # Process batch
            for frame_idx, frame in frame_batch:
                # Calculate frame quality (variance of Laplacian)
                gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
                fm = cv2.Laplacian(gray, cv2.CV_64F).var()
                
                # Detect faces for bonus points
                faces = face_cascade.detectMultiScale(gray, 1.1, 4)
                face_bonus = min(1000, len(faces) * 300)  # Max 1000 bonus
                
                frame_qualities.append((frame_idx, fm + face_bonus, frame, len(faces) > 0))
        
        # Sort by quality and select best frames
        frame_qualities.sort(key=lambda x: x[1], reverse=True)
        best_frames = [x[2] for x in frame_qualities[:min(num_frames, len(frame_qualities))]]
        self.has_faces = any(x[3] for x in frame_qualities[:num_frames])
        
        cap.release()
        return best_frames
    
    def create_professional_thumbnail(self, frame):
        # Convert OpenCV BGR to RGB
        frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        img = Image.fromarray(frame_rgb)
        
        # Create editable image
        thumbnail = img.copy()
        
        # Get thumbnail text from entry
        thumb_text = self.thumb_text_var.get()
        if len(thumb_text) > 20:
            thumb_text = thumb_text[:17] + "..."  # Keep under 20 chars
        
        # Get font size from spinbox
        font_size = self.font_size_var.get()
        
        # Apply slight blur to background for better text readability
        blurred_bg = img.filter(ImageFilter.GaussianBlur(3))
        thumbnail = Image.blend(thumbnail, blurred_bg, 0.2)
        
        # Add gradient overlay for text areas
        overlay = Image.new('RGBA', thumbnail.size, (0, 0, 0, 0))
        overlay_draw = ImageDraw.Draw(overlay)
        
        # Top gradient (fade to dark)
        for y in range(thumbnail.height // 4):
            alpha = int(180 * (1 - y / (thumbnail.height // 4)))
            overlay_draw.line([(0, y), (thumbnail.width, y)], fill=(0, 0, 0, alpha))
        
        # Bottom gradient
        for y in range(thumbnail.height - thumbnail.height // 4, thumbnail.height):
            alpha = int(180 * ((y - (thumbnail.height - thumbnail.height // 4)) / (thumbnail.height // 4)))
            overlay_draw.line([(0, y), (thumbnail.width, y)], fill=(0, 0, 0, alpha))
        
        thumbnail = Image.alpha_composite(thumbnail.convert('RGBA'), overlay).convert('RGB')
        draw = ImageDraw.Draw(thumbnail)
        
        # Choose brand color
        brand_color = self.brand_colors[0]  # First brand color
        
        # Load fonts with fallbacks
        try:
            # Try professional fonts in order
            for font_name in ["impact.ttf", "arialbd.ttf", "BebasNeue-Regular.ttf"]:
                try:
                    font_title = ImageFont.truetype(font_name, font_size)
                    font_cta = ImageFont.truetype(font_name, int(font_size * 0.8))
                    break
                except:
                    continue
            else:
                # Fallback to default font
                font_title = ImageFont.load_default()
                font_cta = ImageFont.load_default()
        except:
            font_title = ImageFont.load_default()
            font_cta = ImageFont.load_default()
        
        # ===== TITLE TEXT =====
        # Use the truncated thumbnail title
        title_text = self.thumbnail_title
        
        # Split title into max 2 lines
        words = title_text.split()
        if len(words) > 3:
            line1 = " ".join(words[:len(words)//2])
            line2 = " ".join(words[len(words)//2:])
        else:
            line1 = title_text
            line2 = ""
        
        # Draw title with outline (top third)
        y_position = thumbnail.height // 6
        if line1:
            self.draw_text_with_outline(
                draw, (thumbnail.width//2, y_position), 
                line1, font_title, "white", "black", "mm"
            )
            y_position += font_size + 10
            
        if line2:
            self.draw_text_with_outline(
                draw, (thumbnail.width//2, y_position), 
                line2, font_title, "white", "black", "mm"
            )
        
        # ===== CALL-TO-ACTION TEXT =====
        # Place in bottom third, avoid bottom-right corner
        cta_x = thumbnail.width // 4  # Left side to avoid duration overlay
        cta_y = thumbnail.height - thumbnail.height // 4
        
        self.draw_text_with_outline(
            draw, (cta_x, cta_y), 
            thumb_text, font_cta, brand_color, "black", "lm"
        )
        
        # ===== BRANDING ELEMENT =====
        # Simple branding element (top-left)
        brand_rect_size = 15
        draw.rectangle(
            [(10, 10), (10 + brand_rect_size, 10 + brand_rect_size)], 
            fill=brand_color, outline="white", width=2
        )
        
        # ===== FOCUS ON FACES =====
        if self.has_faces:
            # Add subtle vignette to draw attention to center
            vignette = Image.new('RGBA', thumbnail.size, (0, 0, 0, 0))
            vignette_draw = ImageDraw.Draw(vignette)
            center_x, center_y = thumbnail.width // 2, thumbnail.height // 2
            max_radius = max(thumbnail.width, thumbnail.height) // 2
            
            for r in range(max_radius, 0, -10):
                alpha = int(100 * (1 - r / max_radius))
                vignette_draw.ellipse(
                    [(center_x - r, center_y - r), (center_x + r, center_y + r)],
                    outline=(0, 0, 0, alpha), 
                    width=10
                )
            
            thumbnail = Image.alpha_composite(thumbnail.convert('RGBA'), vignette)
            draw = ImageDraw.Draw(thumbnail)
        
        # Resize to standard thumbnail size
        thumbnail = thumbnail.resize((1280, 720), Image.LANCZOS)
        
        return thumbnail
    
    def draw_text_with_outline(self, draw, position, text, font, fill, outline, anchor, outline_width=4):
        """Draw text with outline for maximum readability"""
        x, y = position
        # Draw outline (multiple offsets for thicker outline)
        for dx in [-outline_width, 0, outline_width]:
            for dy in [-outline_width, 0, outline_width]:
                if dx == 0 and dy == 0:
                    continue
                draw.text((x+dx, y+dy), text, font=font, fill=outline, anchor=anchor)
        # Draw main text
        draw.text((x, y), text, font=font, fill=fill, anchor=anchor)
    
    def display_thumbnails(self):
        """Display generated thumbnails in the scrollable area"""
        # Clear previous thumbnails
        for widget in self.scrollable_frame.winfo_children():
            widget.destroy()
        
        # Display new thumbnails
        for i, thumb_path in enumerate(self.generated_thumbnails):
            # Load image
            img = Image.open(thumb_path)
            img.thumbnail((400, 225))  # Create preview size
            
            # Convert to Tkinter format
            tk_img = ImageTk.PhotoImage(img)
            
            # Create frame for each thumbnail
            thumb_frame = ttk.Frame(self.scrollable_frame)
            thumb_frame.pack(pady=10, fill=tk.X, padx=10)
            
            # Image label
            label = ttk.Label(thumb_frame, image=tk_img)
            label.image = tk_img  # Keep reference
            label.pack(side=tk.LEFT, padx=10)
            
            # Thumbnail info
            info_frame = ttk.Frame(thumb_frame)
            info_frame.pack(side=tk.LEFT, fill=tk.Y)
            
            ttk.Label(info_frame, text=f"Thumbnail {i+1}", font=("Arial", 10, "bold")).pack(anchor='w')
            ttk.Label(info_frame, text=f"Size: 1280x720").pack(anchor='w')
            ttk.Label(info_frame, text=f"Text: {self.thumbnail_title}").pack(anchor='w')
            
            # Edit button
            edit_btn = ttk.Button(
                thumb_frame, 
                text="Edit", 
                command=lambda path=thumb_path: self.edit_thumbnail(path),
                width=10
            )
            edit_btn.pack(side=tk.RIGHT, padx=10)
    
    def edit_thumbnail(self, thumb_path):
        """Open thumbnail in default image editor"""
        try:
            if os.name == 'nt':  # Windows
                os.startfile(thumb_path)
            elif os.name == 'posix':  # macOS, Linux
                import subprocess
                subprocess.call(('open', thumb_path) if sys.platform == 'darwin' else ('xdg-open', thumb_path))
        except Exception as e:
            messagebox.showerror("Edit Error", f"Could not open image editor: {str(e)}")
    
    def save_thumbnails(self):
        """Save all generated thumbnails to a folder"""
        if not self.generated_thumbnails:
            messagebox.showwarning("No Thumbnails", "Generate thumbnails first")
            return
            
        dir_path = filedialog.askdirectory(title="Select Save Location")
        if not dir_path:
            return
            
        try:
            for thumb_path in self.generated_thumbnails:
                fname = os.path.basename(thumb_path)
                dest = os.path.join(dir_path, fname)
                shutil.copy2(thumb_path, dest)
            
            messagebox.showinfo(
                "Success", 
                f"Saved {len(self.generated_thumbnails)} thumbnails to:\n{dir_path}"
            )
        except Exception as e:
            messagebox.showerror("Save Error", f"Failed to save thumbnails: {str(e)}")
            
    def save_content(self):
        filename = filedialog.asksaveasfilename(
            defaultextension=".txt",
            filetypes=[("Text Files", "*.txt")],
            title="Save Content As"
        )
        
        if not filename:
            return
        
        try:
            with open(filename, "w", encoding="utf-8") as f:
                f.write("=== VIDEO TITLE ===\n")
                f.write(self.title_text.get(1.0, tk.END).strip() + "\n\n")
                
                f.write("=== VIDEO DESCRIPTION ===\n")
                f.write(self.desc_text.get(1.0, tk.END).strip() + "\n\n")
                
                f.write("=== VIDEO TRANSCRIPT ===\n")
                f.write(self.trans_text.get(1.0, tk.END).strip())
            
            messagebox.showinfo("Success", f"Content saved to:\n{filename}")
        except Exception as e:
            messagebox.showerror("Error", f"Failed to save file: {str(e)}")
    
    def __del__(self):
        if self.temp_dir and os.path.exists(self.temp_dir):
            shutil.rmtree(self.temp_dir)
        if self.model:
            del self.model
            torch.cuda.empty_cache() if torch.cuda.is_available() else None
            gc.collect()

if __name__ == "__main__":
    root = tk.Tk()
    app = ContentCreatorApp(root)
    root.mainloop()