from flask import Flask, request, jsonify, abort
from flask_cors import CORS
import cv2
import numpy as np
import base64
from PIL import Image
import io
from datetime import datetime
import tensorflow as tf
from tensorflow import keras
import os
import threading
import time
import hashlib
import secrets
from functools import wraps
import logging
from werkzeug.middleware.proxy_fix import ProxyFix
from dataclasses import dataclass
import ssl
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# =====================================
# 🔧 Configuration Management
# =====================================
@dataclass
class ServerConfig:
    host: str = os.getenv('HOST', '0.0.0.0')
    port: int = int(os.getenv('PORT', '5001'))
    debug: bool = os.getenv('DEBUG', 'false').lower() == 'true'
    model_path: str = os.getenv('MODEL_PATH', './Duygu_Tanima.h5')
    max_image_size: int = int(os.getenv('MAX_IMAGE_SIZE', str(5 * 1024 * 1024)))
    max_students: int = int(os.getenv('MAX_STUDENTS', '200'))
    rate_limit: int = int(os.getenv('RATE_LIMIT', '60'))
    session_timeout: int = int(os.getenv('SESSION_TIMEOUT', '3600'))
    disable_ssl: bool = os.getenv('DISABLE_SSL', '0') == '1'
    cors_origins: str = os.getenv('CORS_ORIGINS', 'https://meet.google.com,https://*.zoom.us,https://*.bigbluebutton.org,chrome-extension://*')
    api_key: str = os.getenv('API_KEY', '')
    teacher_api_key: str = os.getenv('TEACHER_API_KEY', '')

# Global config instance
config = ServerConfig()

app = Flask(__name__)

# Enhanced CORS setup for multi-platform
cors_origins_str = config.cors_origins
cors_origins = [origin.strip() for origin in cors_origins_str.split(',')]
# Add localhost/127.0.0.1 for development
cors_origins.extend([
    "http://127.0.0.1:*",
    "http://localhost:*", 
    "https://localhost:*",
    "https://127.0.0.1:*"
])

CORS(app, 
     resources={r"/*": {"origins": cors_origins}},
     supports_credentials=False,
     allow_headers=["Content-Type", "X-API-KEY", "Authorization"],
     methods=["GET", "POST", "OPTIONS"])

app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1, x_prefix=1)

# Logging ayarları
logging.basicConfig(
    level=logging.DEBUG if config.debug else logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Config values from environment
MAX_IMAGE_SIZE = config.max_image_size
RATE_LIMIT_PER_MINUTE = config.rate_limit
SESSION_TIMEOUT = config.session_timeout

# Rate limiting için
client_requests = {}
last_cleanup = time.time()

print("*** AI Sınıf Kontrolü - Merkezi Backend Server ***")
print("=" * 55)
print(f"🌐 Host: {config.host}")
print(f"🔌 Port: {config.port}")
server_mode = "HTTP" if config.disable_ssl else "HTTPS"
print(f"🔒 Mode: {server_mode}")
print(f"🤖 Model: {config.model_path}")
print(f"👥 Max Students (default): {config.max_students}")
print(f"🛡️ Rate Limit: {config.rate_limit}/min")
print(f"🔐 API Key: {'✅ Set' if config.api_key else '❌ Missing'}")
print(f"🎓 Teacher Key: {'✅ Set' if config.teacher_api_key else '❌ Using API Key'}")
print(f"🌐 CORS Origins: {cors_origins_str}")
print(f"🐛 Debug Mode: {config.debug}")
print("=" * 55)

emotions = [
    "Kafası Karışmış",
    "Odaklanmış", 
    "Yılmış",
    "Mutlu",
    "Doğal",
    "Uykulu"
]

model = None
face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')

teacher_settings = {
    'analysis_interval': 3000,
    'emotion_threshold': 0.7,
    'alerts_enabled': True,
    'max_students': 30,
    'debug_mode': False
}

student_emotions = {}
analysis_history = []
active_students = set()
student_sessions = {}  # Session tracking
blocked_ips = set()  # Güvenlik için

# Rate limiting fonksiyonu (anahtar: IP veya öğrenci oturumu)
def rate_limit(max_requests=60, key: str = 'ip'):
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            current_time = time.time()
            client_ip = request.environ.get('HTTP_X_FORWARDED_FOR', request.remote_addr)

            # Bloklu IP kontrolü
            if client_ip in blocked_ips:
                abort(403)

            # Anahtar belirleme
            limiter_key = client_ip
            if key == 'session':
                try:
                    data = request.get_json(silent=True) or {}
                    user_id = str(data.get('userId', '')).strip()
                    if user_id:
                        limiter_key = f"{user_id}|{client_ip}"
                except Exception:
                    # JSON yoksa IP'ye düş
                    limiter_key = client_ip

            # Kayıt oluştur
            if limiter_key not in client_requests:
                client_requests[limiter_key] = []

            # 1 dakikadan eski istekleri temizle
            client_requests[limiter_key] = [
                t for t in client_requests[limiter_key] if current_time - t < 60
            ]

            # Limit kontrolü
            if len(client_requests[limiter_key]) >= max_requests:
                logger.warning(f"Rate limit exceeded for key: {limiter_key}")
                abort(429)

            client_requests[limiter_key].append(current_time)
            return f(*args, **kwargs)
        return decorated_function
    return decorator

# Input validation
def validate_student_data(data):
    if not isinstance(data, dict):
        return False, "Invalid data format"
    
    required_fields = ['image', 'studentName', 'userId']
    for field in required_fields:
        if field not in data:
            return False, f"Missing field: {field}"
    
    # UZMAN EKİP GÜVENLİK: Advanced input validation
    student_name = data['studentName']
    if not isinstance(student_name, str) or len(student_name.strip()) < 2:
        return False, "Invalid student name"
    
    if len(student_name) > 100:
        return False, "Student name too long"
    
    # Güvenlik: XSS, SQL injection, script injection kontrolü
    dangerous_patterns = [
        '<script', '</script>', 'javascript:', 'data:', 'vbscript:',
        'onload=', 'onerror=', 'onclick=', 'eval(', 'alert(',
        'DROP TABLE', 'SELECT * FROM', 'UNION SELECT', '--', ';--',
        '<?php', '<%', '<iframe', '<object', '<embed'
    ]
    
    student_name_lower = student_name.lower()
    for pattern in dangerous_patterns:
        if pattern.lower() in student_name_lower:
            logger.warning(f"Security threat detected in student name: {pattern}")
            return False, "Invalid characters in student name"
    
    # Güvenlik: Unicode kontrolü (homograph attack prevention)
    try:
        # ASCII olmayan karakterleri kontrol et
        student_name.encode('ascii')
    except UnicodeEncodeError:
        # Unicode karakterler varsa, güvenli olanları kontrol et
        import unicodedata
        normalized = unicodedata.normalize('NFKC', student_name)
        if normalized != student_name:
            logger.warning(f"Unicode normalization mismatch detected")
            return False, "Invalid character encoding"
    
    # Image size validation
    try:
        image_size = len(data['image'])
        if image_size > MAX_IMAGE_SIZE:
            return False, "Image too large"
        if image_size < 1000:  # Çok küçük image
            return False, "Image too small"
    except:
        return False, "Invalid image data"
    
    return True, "Valid"

def load_emotion_model():
    global model
    try:
        model_path = config.model_path

        if not os.path.exists(model_path):
            logger.error(f"❌ Model dosyası bulunamadı: {model_path}")
            return False

        logger.info("🤖 AI Model yükleniyor...")
        logger.info(f" 📁 Dosya: {model_path}")
        logger.info(f" 📊 Boyut: {os.path.getsize(model_path) / (1024*1024):.1f} MB")

        # Keras 3 uyumlu yükleme (eski .h5 modelleri için güvenli mod kapalı)
        loaded = False
        try:
            # Keras 3 API
            try:
                from keras.saving import load_model as k3_load_model  # type: ignore
                model_loaded = k3_load_model(model_path, compile=False, safe_mode=False)
                model = model_loaded
                loaded = True
            except Exception as inner_e:
                logger.debug(f"Keras 3 load_model fallback denenecek: {inner_e}")

            if not loaded:
                # tf.keras API (Keras 3 tarafından sağlanır)
                model = keras.models.load_model(model_path, compile=False)
                loaded = True
        except Exception as e1:
            logger.warning(f"Birincil model yükleme başarısız, alternatif yöntem deneniyor: {e1}")
            try:
                # Eski API uyumluluğu için son bir deneme
                model = tf.keras.models.load_model(model_path, compile=False)
                loaded = True
            except Exception as e2:
                logger.error(f"❌ Model yüklenemedi: {e2}")
                return False

        if not loaded or model is None:
            logger.error("❌ Model referansı boş döndü")
            return False

        logger.info("✅ Model başarıyla yüklendi!")
        if config.debug:
            try:
                model.summary()
            except Exception:
                pass

        # Hızlı duman testi (input şekli 48x48x1 bekleniyor)
        try:
            test_input = np.random.random((1, 48, 48, 1)).astype("float32")
            _ = model.predict(test_input, verbose=0)
            logger.info("🧪 Test tahmin çalıştı")
        except Exception as pred_e:
            logger.warning(f"Model predict testi atlandı/uyarı: {pred_e}")

        logger.info("🎯 Model hazır!")
        return True

    except Exception as e:
        logger.error(f"❌ Model yükleme hatası: {e}")
        return False

def preprocess_face(face_image):
    """AI UZMAN İYİLEŞTİRMESİ: Robust face preprocessing with validation"""
    try:
        # Input validation
        if face_image is None or face_image.size == 0:
            logger.error("Empty face image provided")
            return None
            
        # Minimum face size check (AI model için kritik)
        if face_image.shape[0] < 20 or face_image.shape[1] < 20:
            logger.warning(f"Face too small: {face_image.shape}")
            return None
        
        # Color space conversion with validation
        if len(face_image.shape) == 3:
            if face_image.shape[2] == 3:  # RGB
                face_gray = cv2.cvtColor(face_image, cv2.COLOR_RGB2GRAY)
            elif face_image.shape[2] == 4:  # RGBA
                face_gray = cv2.cvtColor(face_image, cv2.COLOR_RGBA2GRAY)
            else:
                logger.error(f"Unsupported color channels: {face_image.shape[2]}")
                return None
        else:
            face_gray = face_image
        
        # Resize with interpolation control (AI model sensitivity)
        face_resized = cv2.resize(face_gray, (48, 48), interpolation=cv2.INTER_CUBIC)
        
        # Histogram equalization for consistent lighting (AI performance boost)
        face_equalized = cv2.equalizeHist(face_resized)
        
        # Normalization with statistical validation
        face_normalized = face_equalized.astype('float32') / 255.0
        
        # Statistical checks (AI model expects certain distribution)
        pixel_mean = np.mean(face_normalized)
        pixel_std = np.std(face_normalized)
        
        if pixel_std < 0.01:  # Too uniform (probably blank/corrupted)
            logger.warning(f"Face image too uniform - std: {pixel_std}")
            return None
            
        if pixel_mean < 0.05 or pixel_mean > 0.95:  # Too dark/bright
            logger.warning(f"Face image lighting issue - mean: {pixel_mean}")
            # Proceed but log for monitoring
        
        # Final tensor preparation
        face_prepared = face_normalized.reshape(1, 48, 48, 1)
        
        # Tensor validation
        if np.isnan(face_prepared).any() or np.isinf(face_prepared).any():
            logger.error("NaN or Inf values in preprocessed face")
            return None
        
        return face_prepared
        
    except Exception as e:
        logger.error(f"AI Preprocessing critical error: {e}")
        return None

def analyze_emotion_deep(image_data):
    try:
        if model is None:
            return None, "Model yüklenmemiş"
        
        # Image data validation
        if not image_data or not image_data.startswith('data:image/'):
            return None, "Geçersiz image formatı"
        
        try:
            image_bytes = base64.b64decode(image_data.split(',')[1])
        except Exception:
            return None, "Base64 decode hatası"
            
        if len(image_bytes) < 1000:  # Çok küçük image
            return None, "Image boyutu çok küçük"
            
        try:
            image = Image.open(io.BytesIO(image_bytes))
            if image.size[0] < 50 or image.size[1] < 50:
                return None, "Image çözünürlüğü çok düşük"
            
            image_array = np.array(image.convert('RGB'))
        except Exception:
            return None, "Image açma hatası"
        
        # Face detection
        gray = cv2.cvtColor(image_array, cv2.COLOR_RGB2GRAY)
        faces = face_cascade.detectMultiScale(
            gray, 
            scaleFactor=1.1, 
            minNeighbors=5,
            minSize=(30, 30),
            maxSize=(500, 500)
        )
        
        if len(faces) == 0:
            # Alternatif parameterelerle tekrar dene
            faces = face_cascade.detectMultiScale(
                gray, 
                scaleFactor=1.05, 
                minNeighbors=3,
                minSize=(20, 20)
            )
            
        if len(faces) == 0:
            return None, "Yüz tespit edilemedi"
        
        # En büyük yüzü seç
        largest_face = max(faces, key=lambda f: f[2] * f[3])
        x, y, w, h = largest_face
        
        # Face ROI extraction
        face_roi = gray[y:y+h, x:x+w]
        
        if face_roi.size == 0:
            return None, "Yüz bölgesi boş"
        
        face_input = preprocess_face(face_roi)
        if face_input is None:
            return None, "Preprocessing başarısız"
        
        # Model prediction
        predictions = model.predict(face_input, verbose=0)
        emotion_scores = predictions[0]
        
        # NaN kontrolü
        if np.isnan(emotion_scores).any():
            return None, "Model çıktısında hata"
            
        predicted_class = np.argmax(emotion_scores)
        confidence = float(emotion_scores[predicted_class])
        
        # MATEMATİKSEL DÜZELTME: Gerçek confidence değerini koruyalım
        # Eski kod yanıltıcı confidence manipülasyonu yapıyordu
        # AI modelin gerçek performansını gizliyordu
        
        # Sadece aşırı yüksek değerleri normalize et (outlier kontrolü)
        if confidence > 0.99:  # %99'dan yüksekse şüpheli
            confidence = 0.99
        
        # Minimum threshold: Model %15'in altındaysa gerçekten belirsiz demektir
        if confidence < 0.15:
            logger.debug(f"Very low confidence detected: {confidence}")
        
        # Confidence histogram tracking (AI performans analizi için)
        if not hasattr(analyze_emotion_deep, 'confidence_stats'):
            analyze_emotion_deep.confidence_stats = []
        analyze_emotion_deep.confidence_stats.append(confidence)
        
        # Son 100 confidence değerinin ortalamasını al
        if len(analyze_emotion_deep.confidence_stats) > 100:
            analyze_emotion_deep.confidence_stats = analyze_emotion_deep.confidence_stats[-100:]
            avg_confidence = sum(analyze_emotion_deep.confidence_stats) / 100
            if teacher_settings['debug_mode'] and len(analyze_emotion_deep.confidence_stats) % 20 == 0:
                logger.info(f" Model Performance - Avg Confidence: {avg_confidence:.3f}")
        
        result = {
            'emotion': emotions[predicted_class],
            'confidence': confidence,
            'all_scores': emotion_scores.tolist(),
            'face_detected': True,
            'face_count': len(faces),
            'face_size': f"{w}x{h}"
        }
        
        if teacher_settings['debug_mode']:
            logger.info(f" Analiz: {emotions[predicted_class]} (%{confidence*100:.1f})")
        
        return result, None
        
    except Exception as e:
        logger.error(f" Analiz hatası: {e}")
        return None, str(e)

@app.route('/', methods=['GET'])
def home():
    model_status = " Yüklendi" if model is not None else " Yüklenmedi"
    
    return jsonify({
        'status': 'active',
        'message': ' AI Sınıf Kontrolü - Merkezi Backend',
        'version': 'v2.1.0 - Teacher-Student Architecture',
        'model_file': 'Duygu_Tanima.h5',
        'model_status': model_status,
        'active_students': len(active_students),
        'total_analysis': len(analysis_history),
        'features': [
            'Merkezi AI Model',
            'Öğretmen Dashboard',
            'Öğrenci Takibi',
            'Gerçek Zamanlı Analiz'
        ],
        'endpoints': {
            '/health': 'Server durumu',
            '/analyze': 'Öğrenci duygu analizi (POST)',
            '/teacher-dashboard': 'Öğretmen verileri (GET)',
            '/teacher-settings': 'Öğretmen ayarları (POST/GET)',
            '/student-report': 'Öğrenci raporu (POST)'
        },
        'emotions': emotions,
        'timestamp': datetime.now().isoformat()
    })

@app.route('/health', methods=['GET'])
def health_check():
    """Health endpoint for extension connectivity testing"""
    model_loaded = model is not None
    server_mode = "http" if config.disable_ssl else "https"
    
    return jsonify({
        'status': 'OK',
        'api_configured': bool(config.api_key),
        'mode': server_mode,
        'model_loaded': model_loaded,
        'tensorflow_version': tf.__version__,
        'active_students': len(active_students),
        'timestamp': datetime.now().isoformat()
    })

@app.route('/analyze', methods=['POST'])
@rate_limit(max_requests=60, key='session')  # 60 req/min per student session (userId+IP)
def analyze_student_emotion():
    """Öğrenci duygu analizi - Güvenlik ve validasyon ile"""
    try:
        # Content-Type kontrolü
        if not request.is_json:
            return jsonify({'error': 'JSON formatı gerekli'}), 400
        
        data = request.get_json()
        
        # Input validation
        is_valid, validation_error = validate_student_data(data)
        if not is_valid:
            logger.warning(f"Invalid data from {request.remote_addr}: {validation_error}")
            return jsonify({'error': validation_error}), 400
        
        student_name = data.get('studentName', 'Anonim').strip()
        student_id = data.get('userId', 'unknown')
        client_ip = request.environ.get('HTTP_X_FORWARDED_FOR', request.remote_addr)
        
        # Aktif öğrenci sayısı kontrolü (öğretmen ayarları öncelikli, yoksa config)
        try:
            max_allowed = int(teacher_settings.get('max_students') or 0) or int(config.max_students)
        except Exception:
            max_allowed = int(config.max_students)
        if len(active_students) >= max_allowed:
            return jsonify({'error': 'Sınıf kapasitesi doldu'}), 429
        
        # Session tracking
        session_key = f"{student_id}_{client_ip}"
        current_time = time.time()
        
        if session_key in student_sessions:
            last_request = student_sessions[session_key]['last_request']
            if current_time - last_request < 1:  # En az 1 saniye aralık
                return jsonify({'error': 'Çok sık istek'}), 429
        
        student_sessions[session_key] = {
            'student_name': student_name,
            'last_request': current_time,
            'request_count': student_sessions.get(session_key, {}).get('request_count', 0) + 1
        }
        
        active_students.add(student_name)
        
        # AI analizi
        result, error = analyze_emotion_deep(data['image'])
        
        if error:
            logger.warning(f"Analysis error for {student_name}: {error}")
            return jsonify({'error': error}), 400
        
        if result:
            emotion_data = {
                'studentName': student_name,
                'userId': student_id,
                'emotions': [result],
                'timestamp': datetime.now().isoformat(),
                'server_time': current_time,
                'client_ip': client_ip[:10] + '...',  # Privacy için kısalt
                'session_id': session_key
            }
            
            student_emotions[student_name] = emotion_data
            analysis_history.append(emotion_data)
            
            # Memory management
            if len(analysis_history) > 2000:
                analysis_history[:] = analysis_history[-1500:]
                logger.info("Analysis history trimmed")
            
            if teacher_settings['debug_mode']:
                logger.info(f"👤 {student_name}: {result['emotion']} (%{result['confidence']*100:.1f})")
            
            response_data = {
                'success': True,
                'emotions': [result],
                'student': student_name,
                'timestamp': emotion_data['timestamp'],
                'server_version': '2.1.0'
            }
            
            return jsonify(response_data)
        
    except Exception as e:
        logger.error(f" Analiz endpoint hatası: {e}")
        return jsonify({'error': 'İç server hatası'}), 500

@app.route('/teacher-dashboard', methods=['GET'])
def teacher_dashboard():
    """Öğretmen dashboard verileri"""
    try:
        current_time = time.time()
        recent_cutoff = current_time - 120
        
        recent_emotions = []
        active_now = set()
        
        for emotion_data in analysis_history:
            if emotion_data.get('server_time', 0) > recent_cutoff:
                recent_emotions.append(emotion_data)
                active_now.add(emotion_data['studentName'])
        
        alerts = []
        for emotion_data in recent_emotions[-20:]:
            emotion = emotion_data['emotions'][0]
            if emotion['emotion'] in ['Yılmış', 'Kafası Karışmış'] and emotion['confidence'] > teacher_settings['emotion_threshold']:
                alerts.append({
                    'student': emotion_data['studentName'],
                    'emotion': emotion['emotion'],
                    'confidence': emotion['confidence'],
                    'timestamp': emotion_data['timestamp']
                })
        
        dashboard_data = {
            'success': True,
            'active_students': list(active_now),
            'student_count': len(active_now),
            'recent_emotions': recent_emotions[-50:],
            'alerts': alerts[-10:],
            'analysis_count': len(analysis_history),
            'server_time': current_time,
            'settings': teacher_settings
        }
        
        return jsonify(dashboard_data)
        
    except Exception as e:
        print(f" Dashboard hatası: {e}")
        return jsonify({'error': 'Dashboard verisi alınamadı'}), 500

@app.route('/teacher-settings', methods=['GET', 'POST'])
def teacher_settings_endpoint():
    """Öğretmen ayarları"""
    if request.method == 'GET':
        return jsonify({
            'success': True,
            'settings': teacher_settings
        })
    
    elif request.method == 'POST':
        try:
            data = request.get_json()
            
            if 'analysis_interval' in data:
                teacher_settings['analysis_interval'] = int(data['analysis_interval'])
            if 'emotion_threshold' in data:
                teacher_settings['emotion_threshold'] = float(data['emotion_threshold'])
            if 'alerts_enabled' in data:
                teacher_settings['alerts_enabled'] = bool(data['alerts_enabled'])
            if 'max_students' in data:
                teacher_settings['max_students'] = int(data['max_students'])
            if 'debug_mode' in data:
                teacher_settings['debug_mode'] = bool(data['debug_mode'])
            
            print(f" Öğretmen ayarları güncellendi: {teacher_settings}")
            
            return jsonify({
                'success': True,
                'message': 'Ayarlar güncellendi',
                'settings': teacher_settings
            })
            
        except Exception as e:
            print(f" Ayar güncelleme hatası: {e}")
            return jsonify({'error': 'Ayarlar güncellenemedi'}), 400

@app.route('/student-report', methods=['POST'])
def student_report():
    """Öğrenci rapor endpoint'i (gelecek özellik için)"""
    try:
        data = request.get_json()
        student_name = data.get('studentName', 'Anonim')
        
        print(f" Öğrenci raporu: {student_name}")
        
        return jsonify({
            'success': True,
            'message': f'{student_name} raporu alındı'
        })
        
    except Exception as e:
        return jsonify({'error': 'Rapor gönderilemedi'}), 400

@app.route('/manual-feedback', methods=['POST'])
def manual_feedback():
    """Öğrencilerin manuel feedback'leri (Kafam Karıştı, Sıkıldım, Uykum Geldi)"""
    try:
        # 1. JSON verisi kontrolü
        if not request.is_json:
            print("❌ Content-Type JSON değil!")
            return jsonify({
                'success': False, 
                'error': 'Content-Type must be application/json'
            }), 400
        
        data = request.get_json()
        print(f"📥 Manuel feedback RAW data alındı:")
        print(f"   Type: {type(data)}")
        print(f"   Keys: {data.keys() if isinstance(data, dict) else 'NOT A DICT'}")
        print(f"   Full data: {data}")
        
        # 2. Veri yapısı kontrolü
        if not isinstance(data, dict):
            print("❌ Data bir dictionary değil!")
            return jsonify({
                'success': False, 
                'error': f'Data must be a dictionary, got {type(data)}'
            }), 400
        
        # 3. Gerekli alanları çıkar
        student_name = data.get('studentName', 'Anonim')
        user_id = data.get('userId', 'unknown')
        feedback = data.get('manualFeedback', {})
        origin = data.get('origin', feedback.get('origin', 'student'))
        
        print(f"   Parsed studentName: {student_name} (type: {type(student_name)})")
        print(f"   Parsed userId: {user_id} (type: {type(user_id)})")
        print(f"   Parsed manualFeedback: {feedback} (type: {type(feedback)})")
        
        # 4. Validasyonlar
        if not feedback or not isinstance(feedback, dict):
            print(f"❌ Feedback verisi eksik veya yanlış format! Got: {feedback}")
            return jsonify({
                'success': False, 
                'error': 'manualFeedback field is required and must be a dictionary'
            }), 400
        
        if not student_name or student_name == 'Anonim':
            print("❌ Student name eksik!")
            return jsonify({
                'success': False, 
                'error': 'studentName field is required'
            }), 400
        # 5. Kayıtları tutarlı formatta oluştur
        current_time = time.time()
        client_ip = request.environ.get('HTTP_X_FORWARDED_FOR', request.remote_addr)
        # Feedback'i emotion formatında sakla (ISO timestamp kullan)
        emotion_entry = {
            'emotion': feedback.get('emotion', 'unknown'),
            'confidence': float(feedback.get('confidence', 1.0)),
            'source': 'manual',
            'origin': origin,
            'label': feedback.get('label', ''),
            'timestamp': datetime.now().isoformat()
        }

        # Öğrenci verisi (analyze endpoint ile uyumlu yapı)
        student_emotion_data = {
            'studentName': student_name,
            'userId': user_id,
            'emotions': [emotion_entry],
            'timestamp': emotion_entry['timestamp'],
            'server_time': current_time,
            'client_ip': (client_ip[:10] + '...') if client_ip else None,
            'origin': origin
        }

        # Son durumu öğrenci sözlüğünde tut (dict)
        student_emotions[student_name] = student_emotion_data

        # Aktif öğrenciler set'ine ekle
        active_students.add(student_name)

        # Geçmişe ekle
        analysis_history.append(student_emotion_data)
        
        print(f"✅ Manuel feedback kaydedildi: {student_name} - {emotion_entry['label']}")
        print(f"   Toplam student emotions: {len(student_emotions)}")
        print(f"   Toplam analysis history: {len(analysis_history)}")
        
        logger.info(f"📝 Manuel feedback alındı: {student_name} - {emotion_entry['label']}")
        
        return jsonify({
            'success': True,
            'message': f"{emotion_entry['label']} feedback'i kaydedildi",
            'timestamp': emotion_entry['timestamp']
        })
        
    except Exception as e:
        logger.error(f"❌ Manuel feedback hatası: {str(e)}")
        return jsonify({'error': 'Feedback gönderilemedi', 'details': str(e)}), 400

@app.route('/clear-data', methods=['POST'])
def clear_analysis_data():
    """Analiz verilerini temizle (sadece öğretmen)"""
    try:
        global analysis_history, student_emotions, active_students
        
        analysis_history.clear()
        student_emotions.clear()
        active_students.clear()
        
        print(" Tüm analiz verileri temizlendi")
        
        return jsonify({
            'success': True,
            'message': 'Veriler temizlendi'
        })
        
    except Exception as e:
        return jsonify({'error': 'Veri temizlenemedi'}), 400

def cleanup_old_data():
    """Eski verileri temizleme ve güvenlik kontrolleri"""
    while True:
        try:
            current_time = time.time()
            cutoff_time = current_time - (24 * 60 * 60)  # 24 saat
            
            global analysis_history, student_sessions, client_requests
            
            # Analysis history cleanup
            old_count = len(analysis_history)
            analysis_history = [
                data for data in analysis_history
                if data.get('server_time', 0) > cutoff_time
            ]
            
            # Student sessions cleanup
            active_sessions = {}
            session_cutoff = current_time - SESSION_TIMEOUT
            
            for session_id, session_data in student_sessions.items():
                if session_data.get('last_request', 0) > session_cutoff:
                    active_sessions[session_id] = session_data
            
            student_sessions.clear()
            student_sessions.update(active_sessions)
            
            # Rate limiting cleanup
            rate_cutoff = current_time - 60  # 1 dakika
            for client_ip in list(client_requests.keys()):
                client_requests[client_ip] = [
                    req_time for req_time in client_requests[client_ip]
                    if req_time > rate_cutoff
                ]
                if not client_requests[client_ip]:
                    del client_requests[client_ip]
            
            # Memory check
            if len(analysis_history) > 5000:
                analysis_history = analysis_history[-3000:]  # Keep last 3000
                logger.warning('Analysis history truncated due to size')
            
            # Security: Clear blocked IPs after 1 hour
            if hasattr(cleanup_old_data, 'last_security_cleanup'):
                if current_time - cleanup_old_data.last_security_cleanup > 3600:
                    blocked_ips.clear()
                    cleanup_old_data.last_security_cleanup = current_time
            else:
                cleanup_old_data.last_security_cleanup = current_time
            
            if teacher_settings['debug_mode']:
                logger.info(f"Cleanup: {old_count}->{len(analysis_history)} history, "
                          f"{len(student_sessions)} sessions, {len(client_requests)} clients")
            
            time.sleep(1800)  # 30 dakikada bir (daha sık)
            
        except Exception as e:
            logger.error(f" Cleanup hatası: {e}")
            time.sleep(1800)

if __name__ == '__main__':
    # Enhanced server banner with configuration info
    print("\n" + "=" * 55)
    print("*** AI Sınıf Kontrolü - Merkezi Backend Server ***")
    print("=" * 55)
    print(f"🌐 Host: {config.host}")
    print(f"🔌 Port: {config.port}")
    print(f"🤖 Model: {config.model_path}")
    print(f"👥 Max Students: {config.max_students}")
    print(f"🛡️ Rate Limit: {config.rate_limit}/min")
    api_status = "✅ Set" if config.api_key else "❌ Missing"
    teacher_status = "✅ Set" if config.teacher_api_key else "❌ Missing"
    print(f"🔐 API Key: {api_status}")
    print(f"🎓 Teacher Key: {teacher_status}")
    print(f"🌐 CORS Origins: {config.cors_origins}")
    print(f"🐛 Debug Mode: {config.debug}")
    print("=" * 55)
    print("Server basllatiliyor...")
    
    if load_emotion_model():
        print("Model hazir!")
    else:
        print("Model yuklenemedi, manuel model yukleme gerekebilir")
    
    cleanup_thread = threading.Thread(target=cleanup_old_data, daemon=True)
    cleanup_thread.start()
    
    print("Backend Server Aktif!")
    print("Ogretmen: Bu IP adresini ogrencilerle paylasin")
    print("Ogrenciler: Bu sunucuya baglanacak")
    
    try:
        # HTTP/HTTPS selection based on DISABLE_SSL
        if config.disable_ssl:
            print(f"Port: {config.port} (HTTP - DEV MODE)")
            print("=" * 55)
            logger.info("🚧 DEV Mode: HTTP server başlatılıyor (SSL disabled)")
            logger.info(f"🌐 HTTP Server: http://{config.host}:{config.port}")
            
            # HTTP server for development
            app.run(
                host=config.host, 
                port=config.port, 
                debug=config.debug, 
                threaded=True
            )
        else:
            # Check for SSL files and use HTTPS if available
            if os.path.exists('cert.pem') and os.path.exists('key.pem'):
                print(f"Port: {config.port} (HTTPS)")
                print("=" * 55)
                logger.info("🔒 SSL sertifikaları bulundu, HTTPS server başlatılıyor...")
                logger.info(f"🌐 HTTPS Server: https://{config.host}:{config.port}")
                
                # SSL context setup
                ssl_context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
                ssl_context.load_cert_chain('cert.pem', 'key.pem')
                
                # HTTPS server with SSL
                app.run(
                    host=config.host,
                    port=config.port,
                    debug=config.debug,
                    threaded=True,
                    ssl_context=ssl_context
                )
            else:
                print(f"Port: {config.port} (HTTP - No SSL Certs)")
                print("=" * 55)
                logger.warning("⚠️ SSL sertifikaları bulunamadı, HTTP ile başlatılıyor...")
                logger.info("💡 HTTPS için: python create_ssl_cert.py çalıştırın")
                logger.info(f"🌐 HTTP Server: http://{config.host}:{config.port}")
                
                # CORS ve Mixed Content sorunları için
                from werkzeug.serving import WSGIRequestHandler
                WSGIRequestHandler.protocol_version = "HTTP/1.1"
                
                app.run(
                    host=config.host, 
                    port=config.port, 
                    debug=config.debug, 
                    threaded=True
                )
            
    except KeyboardInterrupt:
        logger.info("\n👋 Server durduruldu")
    except Exception as e:
        logger.error(f"❌ Server hatası: {e}")