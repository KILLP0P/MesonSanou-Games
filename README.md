```markdown
# MESON SANOU & GAMES

Demo de un casino virtual con dos minijuegos: AL-SANOWI SLOTS y XELIQUITA DERBY.

El proyecto está desarrollado con JavaScript, Phaser y Vite. Todo funciona con saldo ficticio: no hay depósitos, retiradas ni premios de dinero real.

> Estado: **DEMO** en desarrollo.
>
> Poker: desactivado temporalmente.
>
> Multijugador: próximamente.

---

## Juegos disponibles

### AL-SANOWI SLOTS

Slot de 3 filas y 5 columnas con 243 formas de ganar.

Incluye:

- Combinaciones desde la primera columna, de izquierda a derecha.
- Premios por símbolos en 3, 4 o 5 columnas consecutivas.
- Cascadas con multiplicadores.
- Comodines y scatters.
- Tiradas gratuitas.
- Bonus de placas de dinero.
- Cámara del tesoro con tablero de 5 × 10.
- Cofres del explorador.
- Ruleta de premios y multiplicadores.
- Apuestas seleccionables y autoplay.
- Sonidos y celebraciones de premios.
- Historial de las últimas tiradas.
- Resumen de sesión y modo ADMIN para pruebas.

El equilibrio económico es experimental. No se presenta como un juego con RTP certificado.

### XELIQUITA DERBY

Carreras de ocho caballos con animaciones y apuesta a ganador.

Incluye:

- Listado rotativo de 50 nombres.
- Nombres distintos dentro de cada carrera.
- Probabilidades y cuotas visibles.
- Caballos y jinetes dibujados por código.
- Clasificación en directo y adelantamientos visuales.
- Recta final a cámara lenta.
- Sonidos de preparación, disparo de salida, carrera y resultado.
- Ambiente de fondo en bucle.
- Historial de carreras.
- Resumen de sesión.
- Pruebas ADMIN que no alteran el crédito ni las estadísticas.

Los nombres son referencias a personajes y personas vinculados a juegos de Rockstar. El proyecto no está afiliado a Rockstar Games.

### Poker

La entrada aparece en el menú, pero está desactivada y su escena no se carga en esta versión.

---

## Crédito y sesiones

El crédito es compartido entre los minijuegos y se guarda en el navegador.

Desde el menú principal puedes:

- Recargar 100 € ficticios.
- Reclamar el bonus diario cuando esté disponible.
- Reiniciar el crédito a 0 €.
- Consultar el historial de sesiones.

Cada entrada a un minijuego comienza una sesión nueva. Al salir, se conserva el crédito y se guarda el resumen de la sesión.

Los resultados distinguen:

- Apostado: importe gastado en apuestas.
- Premios cobrados: importe recibido.
- Resultado neto: premios cobrados menos lo apostado.

Ejemplo: apostar 1 € y cobrar 0,40 € produce un resultado neto de −0,60 €.

El progreso se almacena localmente mediante `localStorage`. No hay cuentas de usuario ni sincronización entre dispositivos. Borrar los datos del sitio puede eliminar el progreso y los historiales.

---

## Requisitos

Para ejecutar el proyecto necesitas:

- Node.js LTS con npm.
- Un navegador moderno.
- Los archivos completos del proyecto.
- Conexión a Internet para descargar las dependencias la primera vez.

No necesitas Python, XAMPP ni una base de datos externa.

Un editor como Antigravity, Visual Studio Code o similar es opcional.

---

## Instalación y ejecución

### 1. Descargar el proyecto

Descarga el repositorio como ZIP y extráelo.

También puedes clonarlo con Git:

    git clone <URL_DEL_REPOSITORIO>

### 2. Abrir una terminal

Entra en la carpeta donde se encuentra `package.json`.

### 3. Instalar las dependencias

    npm install

### 4. Iniciar el servidor de desarrollo

    npm run dev

Abre en el navegador la dirección que indique Vite, normalmente:

    http://localhost:5173

Mantén la terminal abierta mientras uses el servidor.

Para detenerlo, pulsa `Ctrl + C`.

---

## Generar una compilación

Para crear la versión compilada:

    npm run build

El resultado se genera en `dist`.

Para previsualizar esa compilación localmente:

    npm run preview

Publicar los archivos fuente en GitHub no publica automáticamente una demo jugable. El alojamiento web necesita configurarse por separado.

---

## Recursos de sonido y vídeo

Las rutas del proyecto esperan los recursos en:

    public/
    └── sfx/
        ├── ambient.mp3
        ├── jackpot.mp3
        ├── 777.mp3
        ├── max.mp4
        ├── start.mp3
        ├── shoot.mp3
        ├── horse.mp3
        ├── horse_amb.mp3
        └── fail.mp3

### Slots

- `ambient.mp3`: música de ambiente.
- `jackpot.mp3`: resultados de bonus y premios especiales.
- `777.mp3`: celebración de premios.
- `max.mp4`: vídeo del premio máximo.

### Derby

- `start.mp3`: preparación de la salida.
- `shoot.mp3`: disparo posterior a la preparación.
- `horse.mp3`: sonido durante la carrera.
- `horse_amb.mp3`: ambiente de fondo.
- `777.mp3`: victoria.
- `fail.mp3`: derrota.

La carrera comienza cuando termina `shoot.mp3`.

Utiliza recursos propios o con permisos adecuados para su distribución. Si los recursos no están incluidos en el repositorio, deberás añadirlos respetando estos nombres.

---

## Estructura principal

    index.html
    package.json
    public/
    └── sfx/
    src/
    ├── main.js
    ├── state.js
    ├── ui.js
    ├── sfx.js
    ├── horseAudio.js
    ├── demoBranding.js
    ├── scenes/
    │   ├── MenuScene.js
    │   ├── SlotsScene.js
    │   ├── HorseRaceScene.js
    │   ├── HistoryScene.js
    │   └── PokerScene.js
    └── slots/
        ├── config.js
        ├── BonusGame.js
        ├── WheelGame.js
        ├── upgrade.js
        ├── features.js
        └── polish.js

---

## Herramientas de desarrollo

Los minijuegos incluyen opciones ADMIN para probar resultados y funciones especiales.

El código de acceso local es:

    280816

Este código no es una protección de seguridad. Las herramientas ADMIN forman parte de una demo local y deben revisarse antes de publicar una versión destinada a usuarios finales.

Las pruebas aisladas están diseñadas para no alterar las estadísticas normales. Si modificas sus funciones, comprueba que siga cumpliéndose esa separación.

---

## Limitaciones de la demo

- Solo utiliza crédito ficticio.
- No dispone de backend ni autenticación.
- No admite pagos ni retiradas.
- El equilibrio de los premios es experimental.
- El progreso depende del almacenamiento del navegador.
- Poker no está disponible.
- El multijugador todavía no está implementado.

---

## Próximos pasos

- Mejoras de presentación y accesibilidad.
- Pruebas de equilibrio y estabilidad.
- Reactivación y mejora de Poker.
- Funciones multijugador.
- Más opciones de personalización.

---

## Reportar problemas

Si encuentras un error, abre una incidencia en el repositorio indicando:

1. Qué estabas haciendo.
2. Qué resultado esperabas.
3. Qué ocurrió.
4. Navegador y sistema operativo.
5. Mensaje de error de la consola, si existe.
6. Captura de pantalla, si ayuda a reproducirlo.

---

## Uso de la demo

Proyecto de entretenimiento y aprendizaje con saldo ficticio.

Las referencias a otros videojuegos no implican afiliación con sus desarrolladores. El código y los recursos multimedia pueden tener condiciones de uso distintas: revisa los permisos antes de reutilizarlos o redistribuirlos.
```