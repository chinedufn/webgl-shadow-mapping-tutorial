var glMat4 = require('gl-mat4')
var stanfordDragon = require('stanford-dragon/4')

var canvas = document.createElement('canvas')
canvas.width = 500
canvas.height = 500
var mountLocation = document.getElementById('webgl-shadow-map-tut') || document.body
mountLocation.appendChild(canvas)

var gl = canvas.getContext('webgl')
gl.enable(gl.DEPTH_TEST)

var canvasIsPressed = false
var xRotation = Math.PI / 20
var yRotation = 0
var lastPressX
var lastPressY
canvas.onmousedown = function (e) {
  canvasIsPressed = true
  lastPressX = e.pageX
  lastPressY = e.pageY
}
canvas.onmouseup = function () {
  canvasIsPressed = false
}
canvas.onmouseout = function () {
  canvasIsPressed = false
}
canvas.onmousemove = function (e) {
  if (canvasIsPressed) {
    xRotation += (e.pageY - lastPressY) / 50
    yRotation -= (e.pageX - lastPressX) / 50

    xRotation = Math.min(xRotation, Math.PI / 2.5)
    xRotation = Math.max(xRotation, 0.1)

    lastPressX = e.pageX
    lastPressY = e.pageY
  }
}

// As you drag your finger we move the camera
canvas.addEventListener('touchstart', function (e) {
  lastPressX = e.touches[0].clientX
  lastPressY = e.touches[0].clientY
})
canvas.addEventListener('touchmove', function (e) {
  e.preventDefault()
  xRotation += (e.touches[0].clientY - lastPressY) / 50
  yRotation -= (e.touches[0].clientX - lastPressX) / 50

  xRotation = Math.min(xRotation, Math.PI / 2.5)
  xRotation = Math.max(xRotation, 0.1)

  lastPressX = e.touches[0].clientX
  lastPressY = e.touches[0].clientY
})

var vertexGLSL = `
attribute vec3 aVertexPosition;

uniform mat4 uPMatrix;
uniform mat4 uMVMatrix;
uniform mat4 lightMViewMatrix;
uniform mat4 lightProjectionMatrix;
const mat4 texUnits = mat4(0.5, 0.0, 0.0, 0.0, 0.0, 0.5, 0.0, 0.0, 0.0, 0.0, 0.5, 0.0, 0.5, 0.5, 0.5, 1.0);

varying vec2 vDepthUv;
varying vec4 shadowPos;

void main (void) {
  gl_Position = uPMatrix * uMVMatrix * vec4(aVertexPosition, 1.0);

  shadowPos = texUnits * lightProjectionMatrix * lightMViewMatrix * vec4(aVertexPosition, 1.0);
}
`

var fragmentGLSL = `
precision mediump float;

varying vec2 vDepthUv;
varying vec4 shadowPos;

uniform sampler2D depthColorTexture;
uniform vec3 uColor;

float unpack (vec4 color) {
  const vec4 bitShifts = vec4(
    1.0 / (256.0 * 256.0 * 256.0),
    1.0 / (256.0 * 256.0),
    1.0 / 256.0,
    1
  );
  return dot(color, bitShifts);
}

void main(void) {
  vec3 fragmentDepth = shadowPos.xyz;
  float acneRemover = 0.007;
  fragmentDepth.z -= acneRemover;

  float texelSize = 1.0 / 1024.0;
  float amountInLight = 0.0;

  for (int x = -1; x <= 1; x++) {
    for (int y = -1; y <= 1; y++) {
      float texelDepth = unpack(texture2D(depthColorTexture, fragmentDepth.xy + vec2(x, y) * texelSize));
      if (fragmentDepth.z < texelDepth) {
        amountInLight += 1.0;
      }
    }
  }
  amountInLight /= 9.0;

  gl_FragColor = vec4(amountInLight * uColor, 1.0);
}
`

// TODO: Rename to depth VS and depth FS
var shadowVertexGLSL = `
attribute vec3 aVertexPosition;

uniform mat4 uPMatrix;
uniform mat4 uMVMatrix;

void main (void) {
  gl_Position = uPMatrix * uMVMatrix * vec4(aVertexPosition, 1.0);
}
`

var shadowFragmentGLSL = `
precision mediump float;

vec4 pack (float depth) {
  const vec4 bitSh = vec4(
    256 * 256 * 256,
    256 * 256,
    256,
    1.0
  );
  const vec4 bitMask = vec4(
    0,
    1.0 / 256.0,
    1.0 / 256.0,
    1.0 / 256.0
  );
  vec4 comp = fract(depth * bitSh);
  comp -= comp.xxyz * bitMask;
  return comp;
}

void main (void) {
  gl_FragColor = pack(gl_FragCoord.z);
}
`

var vertexShader = gl.createShader(gl.VERTEX_SHADER)
gl.shaderSource(vertexShader, vertexGLSL)
gl.compileShader(vertexShader)
console.log(gl.getShaderInfoLog(vertexShader))

var fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)
gl.shaderSource(fragmentShader, fragmentGLSL)
gl.compileShader(fragmentShader)
console.log(gl.getShaderInfoLog(fragmentShader))

var shaderProgram = gl.createProgram()
gl.attachShader(shaderProgram, vertexShader)
gl.attachShader(shaderProgram, fragmentShader)
gl.linkProgram(shaderProgram)

var shadowVertexShader = gl.createShader(gl.VERTEX_SHADER)
gl.shaderSource(shadowVertexShader, shadowVertexGLSL)
gl.compileShader(shadowVertexShader)
console.log(gl.getShaderInfoLog(shadowVertexShader))

var shadowFragmentShader = gl.createShader(gl.FRAGMENT_SHADER)
gl.shaderSource(shadowFragmentShader, shadowFragmentGLSL)
gl.compileShader(shadowFragmentShader)
console.log(gl.getShaderInfoLog(shadowFragmentShader))

var shadowProgram = gl.createProgram()
gl.attachShader(shadowProgram, shadowVertexShader)
gl.attachShader(shadowProgram, shadowFragmentShader)
gl.linkProgram(shadowProgram)

var floorPositions = [
  // Bottom Left (0)
  -30.0, 0.0, 30.0,
  // Bottom Right (1)
  30.0, 0.0, 30.0,
  // Top Right (2)
  30.0, 0.0, -30.0,
  // Top Left (3)
  -30.0, 0.0, -30.0
]
var floorIndices = [
  // Front face
  0, 1, 2, 0, 2, 3
]
var dragonPositions = stanfordDragon.positions
var dragonIndices = stanfordDragon.cells
dragonPositions = dragonPositions.reduce(function (all, vertex) {
  all.push(vertex[0] / 10)
  all.push(vertex[1] / 10)
  all.push(vertex[2] / 10)
  return all
}, [])
dragonIndices = dragonIndices.reduce(function (all, vertex) {
  all.push(vertex[0])
  all.push(vertex[1])
  all.push(vertex[2])
  return all
}, [])

var vertexPositionAttrib = gl.getAttribLocation(shadowProgram, 'aVertexPosition')
gl.enableVertexAttribArray(vertexPositionAttrib)

var dragonPositionBuffer = gl.createBuffer()
gl.bindBuffer(gl.ARRAY_BUFFER, dragonPositionBuffer)
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(dragonPositions), gl.STATIC_DRAW)
gl.vertexAttribPointer(vertexPositionAttrib, 3, gl.FLOAT, false, 0, 0)

var dragonIndexBuffer = gl.createBuffer()
gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, dragonIndexBuffer)
gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(dragonIndices), gl.STATIC_DRAW)

var floorPositionBuffer = gl.createBuffer()
gl.bindBuffer(gl.ARRAY_BUFFER, floorPositionBuffer)
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(floorPositions), gl.STATIC_DRAW)
gl.vertexAttribPointer(vertexPositionAttrib, 3, gl.FLOAT, false, 0, 0)

var floorIndexBuffer = gl.createBuffer()
gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, floorIndexBuffer)
gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(floorIndices), gl.STATIC_DRAW)

/**
 * Shadow
 */
gl.useProgram(shadowProgram)

gl.bindBuffer(gl.ARRAY_BUFFER, dragonPositionBuffer)
gl.vertexAttribPointer(vertexPositionAttrib, 3, gl.FLOAT, false, 0, 0)

gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, dragonIndexBuffer)
gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(dragonIndices), gl.STATIC_DRAW)

var shadowFramebuffer = gl.createFramebuffer()
gl.bindFramebuffer(gl.FRAMEBUFFER, shadowFramebuffer)

var shadowDepthTexture = gl.createTexture()
gl.bindTexture(gl.TEXTURE_2D, shadowDepthTexture)
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1024, 1024, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)

var renderBuffer = gl.createRenderbuffer()
gl.bindRenderbuffer(gl.RENDERBUFFER, renderBuffer)
gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, 1024, 1024)

gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, shadowDepthTexture, 0)
gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, renderBuffer)

gl.bindTexture(gl.TEXTURE_2D, null)
gl.bindRenderbuffer(gl.RENDERBUFFER, null)

var lightProjectionMatrix = glMat4.ortho([], -40, 40, -40, 40, -40.0, 80)

// TODO: This is a model view matrix
var lightMViewMatrix = glMat4.lookAt([], [0, 2, -3], [0, 0, 0], [0, 1, 0])

var shadowPMatrix = gl.getUniformLocation(shadowProgram, 'uPMatrix')
var shadowMVMatrix = gl.getUniformLocation(shadowProgram, 'uMVMatrix')

gl.uniformMatrix4fv(shadowPMatrix, false, lightProjectionMatrix)
gl.uniformMatrix4fv(shadowMVMatrix, false, lightMViewMatrix)

gl.viewport(0, 0, 1024, 1024)
gl.clearColor(0, 0, 0, 1)
gl.clearDepth(1.0)
gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

/**
 * Floor
 */
gl.bindBuffer(gl.ARRAY_BUFFER, floorPositionBuffer)
gl.vertexAttribPointer(vertexPositionAttrib, 3, gl.FLOAT, false, 0, 0)

gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, floorIndexBuffer)
gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(floorIndices), gl.STATIC_DRAW)

/**
 * Mip map
 */

gl.bindFramebuffer(gl.FRAMEBUFFER, null)

/**
 * Scene
 */
gl.useProgram(shaderProgram)

var vertexPositionAttrib = gl.getAttribLocation(shaderProgram, 'aVertexPosition')
gl.enableVertexAttribArray(vertexPositionAttrib)

// TODO: Rename
var samplerUniform = gl.getUniformLocation(shaderProgram, 'depthColorTexture')

gl.activeTexture(gl.TEXTURE0)
gl.bindTexture(gl.TEXTURE_2D, shadowDepthTexture)
gl.uniform1i(samplerUniform, 0)

var uMVMatrix = gl.getUniformLocation(shaderProgram, 'uMVMatrix')
var uPMatrix = gl.getUniformLocation(shaderProgram, 'uPMatrix')
var uLightMatrix = gl.getUniformLocation(shaderProgram, 'lightMViewMatrix')
var uLightProjection = gl.getUniformLocation(shaderProgram, 'lightProjectionMatrix')
var uColor = gl.getUniformLocation(shaderProgram, 'uColor')

gl.uniformMatrix4fv(uLightMatrix, false, lightMViewMatrix)
gl.uniformMatrix4fv(uLightProjection, false, lightProjectionMatrix)

/**
 * Floor
 */

console.log(gl.getError())

var dragonRotateY = 0

var lightDragonMVMatrix
var cameraDragonMVMatrix

function drawShadowMap () {
  dragonRotateY += 0.01

  gl.useProgram(shadowProgram)
  // gl.cullFace(gl.FRONT)

  gl.bindFramebuffer(gl.FRAMEBUFFER, shadowFramebuffer)

  gl.viewport(0, 0, 1024, 1024)
  gl.clearColor(0, 0, 0, 1)
  gl.clearDepth(1.0)
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

  gl.bindBuffer(gl.ARRAY_BUFFER, dragonPositionBuffer)
  gl.vertexAttribPointer(vertexPositionAttrib, 3, gl.FLOAT, false, 0, 0)
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, dragonIndexBuffer)

  lightDragonMVMatrix = glMat4.create()
  glMat4.rotateY(lightDragonMVMatrix, lightDragonMVMatrix, dragonRotateY)
  glMat4.multiply(lightDragonMVMatrix, lightMViewMatrix, lightDragonMVMatrix)
  gl.uniformMatrix4fv(shadowMVMatrix, false, lightDragonMVMatrix)

  gl.drawElements(gl.TRIANGLES, dragonIndices.length, gl.UNSIGNED_SHORT, 0)

  gl.bindBuffer(gl.ARRAY_BUFFER, floorPositionBuffer)
  gl.vertexAttribPointer(vertexPositionAttrib, 3, gl.FLOAT, false, 0, 0)
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, floorIndexBuffer)

  gl.uniformMatrix4fv(shadowMVMatrix, false, lightMViewMatrix)

  gl.drawElements(gl.TRIANGLES, floorIndices.length, gl.UNSIGNED_SHORT, 0)

  // gl.cullFace(gl.BACK)

  gl.bindFramebuffer(gl.FRAMEBUFFER, null)
}

function drawModels () {
  gl.useProgram(shaderProgram)

  var camera = glMat4.create()
  glMat4.translate(camera, camera, [0, 0, 45])

  var xRotMatrix = glMat4.create()
  var yRotMatrix = glMat4.create()

  glMat4.rotateX(xRotMatrix, xRotMatrix, -xRotation)
  glMat4.rotateY(yRotMatrix, yRotMatrix, yRotation)

  glMat4.multiply(camera, xRotMatrix, camera)
  glMat4.multiply(camera, yRotMatrix, camera)

  camera = glMat4.lookAt(camera, [camera[12], camera[13], camera[14]], [0, 0, 0], [0, 1, 0])

  // Rename to Light Matrix
  lightDragonMVMatrix = glMat4.create()
  glMat4.rotateY(lightDragonMVMatrix, lightDragonMVMatrix, dragonRotateY)
  glMat4.multiply(lightDragonMVMatrix, lightMViewMatrix, lightDragonMVMatrix)
  gl.uniformMatrix4fv(uMVMatrix, false, lightDragonMVMatrix)

  gl.uniformMatrix4fv(uLightMatrix, false, lightDragonMVMatrix)

  var dragonMVMatrix = glMat4.create()
  glMat4.rotateY(dragonMVMatrix, dragonMVMatrix, dragonRotateY)
  glMat4.multiply(dragonMVMatrix, camera, dragonMVMatrix)
  gl.uniformMatrix4fv(uMVMatrix, false, dragonMVMatrix)

  gl.uniformMatrix4fv(uPMatrix, false, glMat4.perspective([], Math.PI / 3, 1, 0.01, 900))
  gl.uniform3fv(uColor, [0.36, 0.66, 0.8])

  gl.activeTexture(gl.TEXTURE0)
  gl.bindTexture(gl.TEXTURE_2D, shadowDepthTexture)
  gl.uniform1i(samplerUniform, 0)

  gl.viewport(0, 0, 500, 500)
  gl.clearColor(0.98, 0.98, 0.98, 1)
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

  gl.bindBuffer(gl.ARRAY_BUFFER, dragonPositionBuffer)
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, dragonIndexBuffer)
  gl.vertexAttribPointer(vertexPositionAttrib, 3, gl.FLOAT, false, 0, 0)
  gl.drawElements(gl.TRIANGLES, dragonIndices.length, gl.UNSIGNED_SHORT, 0)

  gl.bindBuffer(gl.ARRAY_BUFFER, floorPositionBuffer)
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, floorIndexBuffer)
  gl.vertexAttribPointer(vertexPositionAttrib, 3, gl.FLOAT, false, 0, 0)

  gl.uniformMatrix4fv(uLightMatrix, false, lightMViewMatrix)
  gl.uniformMatrix4fv(uMVMatrix, false, camera)
  gl.uniform3fv(uColor, [0.6, 0.6, 0.6])

  gl.drawElements(gl.TRIANGLES, floorIndices.length, gl.UNSIGNED_SHORT, 0)
}

function draw () {
  drawShadowMap()
  drawModels()

  window.requestAnimationFrame(draw)
}
draw()


function createImageFromTexture(gl, texture, width, height) {
  // Create a framebuffer backed by the texture
  var framebuffer = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

  // Read the contents of the framebuffer
  var data = new Uint8Array(width * height * 4);
  gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, data);

  gl.deleteFramebuffer(framebuffer);

  // Create a 2D canvas to store the result
  var canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  var context = canvas.getContext('2d');

  // Copy the pixels to a 2D canvas
  var imageData = context.createImageData(width, height);
  imageData.data.set(data);
  context.putImageData(imageData, 0, 0);

  var img = new Image();
  img.src = canvas.toDataURL();
  return img;
}
document.body.appendChild(
  createImageFromTexture(gl, shadowDepthTexture, 1024, 1024)
)
