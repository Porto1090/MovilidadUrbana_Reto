# MovilidadUrbana_Reto
Repositorio para entrega del reto de la clase Modelación de sistemas multiagentes con gráficas computacionales (Gpo 301)

Link al video de youtube [VideoFinal_MovilidadUrbana](https://youtu.be/EW02xKlUDeQ)

### Integrantes del equipo
- [Eduardo Porto Morales - A01027893](https://github.com/Porto1090)
- [Do Kyu Han - A01025119](https://github.com/dokyuhan)
  
## Descripción del Proyecto

Generar una simulación de la circulación de un automóvil en una ciudad donde coches (agentes) interactúan para llegar a sus destinos.
En este caso, vamos a utilizar [Mesa](https://mesa.readthedocs.io/stable/) para la simulación de agentes y [WebGL](https://get.webgl.org/) para la visualización de gráficas.

## Visualización del Proyecto

- El servidor de simulación gestiona y ejecuta los agentes de la simulación por medio de Mesa, proporcionando los datos relevantes a través de una API RESTful construida con Flask.
- El servidor de visualización toma estos datos y los presenta en una interfaz gráfica interactiva 3D usando WebGL. Para la gestión y despliegue del cliente en el navegador, se utiliza Vite como servidor de desarrollo.

## Instalar Dependencias y hacer funcionar la aplicación en el entorno local

### Clonar este repositorio

```bash
https://github.com/Porto1090/MovilidadUrbana_Reto.git
```

#### 1. Servidor de Simulación (Mesa + Flask)

  * Navegar a la ruta del servidor `Server/agentsServer`
  ```bash
  cd ~/MovilidadUrbana_Reto/AgentsVisualization/Server/agentsServer
  ```

  > [!NOTE]
  > Primero, asegúrate de tener Python instalado en tu máquina. Si estás usando un entorno virtual (recomendado), sigue estos pasos:
  
  1.1 Crear un entorno Virtual (venv):
  ```bash
  python -m venv venv
  ```

  1.2 Activa el entorno virtual:
  - En macOS/Linux:
  ```bash
  source venv/bin/activate
  ```
  - En Windows:
  ```bash
  .\venv\Scripts\activate 
  ```

  1.3 Instala las dependencias del servidor Flask:
  ```bash
  pip install mesa==2.4.0 flask flask_cors
  ```
  
  ##### Esto instalará:

  > * Mesa 2.4.0: la biblioteca para la simulación de agentes.
  > * Flask: para crear la API RESTful.
  > * Flask-CORS: para habilitar CORS y permitir solicitudes desde el servidor de visualización.

  1.4 Inicia el servidor de desarrollo: Una vez instaladas las dependencias, puedes iniciar el servidor de desarrollo de la visualización con:
  ```bash
  python agents_server.py
  ```

> El script comenzará a escuchar en el puerto 8585, y podrás acceder a la API de simulación y sus endpoitns en [http://localhost:8585/](http://localhost:8585/).

#### 2. Servidor de Visualización (Frontend)

  * Navegar a la ruta del servidor `Visualization`
  ```bash
  cd ~/MovilidadUrbana_Reto/AgentsVisualization/Visualization
  ```

  > [!NOTE]
  > Para la visualización interactiva, necesitas Node.js y npm. Si no los tienes instalados, puedes descargarlos desde su sitio oficial.

  2.1 Instala las dependencias del servidor de visualización, ejecuta
  ```bash
  npm install
  ```
  ##### Esto instalará:

  > * lil-gui@0.19.2 para la creación de interfaces gráficas de usuario
  > * twgl.js@5.5.4 para facilitar la manipulación de WebGL
  > * vite@5.4.11 como servidor de desarrollo y empaquetado del proyecto

  2.2  Inicia el servidor de desarrollo: Una vez instaladas las dependencias, puedes iniciar el servidor de desarrollo de la visualización con:
  ```bash
  npx vite
  ```

> Esto iniciará un servidor en [http://localhost:5173/](http://localhost:5173/), donde podrás ver la interfaz interactiva en 3D generada por los datos proporcionados por el servidor de simulación.
