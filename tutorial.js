var glMat4 = require('gl-mat4')

var canvas = document.createElement('canvas')
canvas.width = 500
canvas.height = 500
var gl = canvas.getContext('webgl')
var mountLocation = document.getElementById('webgl-shadow-mapping-tut') || document.body
mountLocation.appendChild(canvas)

gl.viewport(0, 0, 500, 500)
gl.clearColor(1, 0, 1, 1)
gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

var vertexGLSL = `
attribute vec3 aVertexPosition;

uniform mat4 uPMatrix;
uniform mat4 uMVMatrix;

void main (void) {
  gl_Position = uPMatrix * uMVMatrix * vec4(aVertexPosition, 1.0);
}
`

var fragmentGLSL = `
precision mediump float;

void main(void) {
  gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0);
}
`

var vertexShader = gl.createShader(gl.VERTEX_SHADER)
gl.shaderSource(vertexShader, vertexGLSL)
gl.compileShader(vertexShader)

var fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)
gl.shaderSource(fragmentShader, fragmentGLSL)
gl.compileShader(fragmentShader)

var shaderProgram = gl.createProgram()
gl.attachShader(shaderProgram, vertexShader)
gl.attachShader(shaderProgram, fragmentShader)
gl.linkProgram(shaderProgram)
gl.useProgram(shaderProgram)

var vertexPositionAttrib = gl.getAttribLocation(shaderProgram, 'aVertexPosition')
gl.enableVertexAttribArray(vertexPositionAttrib)

var vertexPositions = [
  // Front Bottom Left
  0.0, 0.0, 0.0,
  // Front Bottom Right
  1.0, 0.0, 0.0,
  // Front Top Right
  1.0, 1.0, 0.0,
  // Front Top Left
  0.0, 1.0, 0.0,
  // Back Bottom Left
  0.0, 0.0, -1.0,
  // Back Bottom Right
  1.0, 0.0, -1.0,
  // Back Top Right
  1.0, 1.0, -1.0,
  // Back Top Left
  0.0, 1.0, -1.0
]
var vertexIndices = [
  // Front face
  0, 1, 2, 0, 2, 3,
  // Back Face
  4, 5, 6, 4, 6, 7,
  // Left Face
  4, 0, 1, 4, 1, 5,
  // Right Face
  1, 5, 7, 1, 7, 3,
  // Top Face
  3, 2, 6, 3, 6, 7,
  // Bottom Face
  0, 1, 5, 0, 5, 4
]

/**
 * Scene
 */

var vertexPositionBuffer = gl.createBuffer()
gl.bindBuffer(gl.ARRAY_BUFFER, vertexPositionBuffer)
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertexPositions), gl.STATIC_DRAW)
gl.vertexAttribPointer(vertexPositionAttrib, 3, gl.FLOAT, false, 0, 0)

var vertexIndexBuffer = gl.createBuffer()
gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, vertexIndexBuffer)
gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint8Array(vertexIndices), gl.STATIC_DRAW)

var uMVMatrix = gl.getUniformLocation(shaderProgram, 'uMVMatrix')
var uPMatrix = gl.getUniformLocation(shaderProgram, 'uPMatrix')

var camera = glMat4.lookAt([], [0, 4, 5], [0, 0, 0], [0, 1, 0])
gl.uniformMatrix4fv(uMVMatrix, false, camera)
gl.uniformMatrix4fv(uPMatrix, false, glMat4.perspective([], Math.PI / 3, 1, 0.01, 100))

gl.drawElements(gl.TRIANGLES, vertexIndices.length, gl.UNSIGNED_BYTE, 0)

/**
 * Shadow
 */

var shadowFramebuffer = gl.createFramebuffer()
gl.bindFramebuffer(gl.FRAMEBUFFER, shadowFramebuffer)

var shadowDepthTexture = gl.createTexture()
gl.bindTexture(gl.TEXTURE_2D, shadowDepthTexture)
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 512, 512, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)

var renderBuffer = gl.createRenderbuffer()
gl.bindRenderbuffer(gl.RENDERBUFFER, renderBuffer)
gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, 512, 512)

gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, shadowDepthTexture, 0)
gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, renderBuffer)

gl.bindTexture(gl.TEXTURE_2D, null)
gl.bindRenderbuffer(gl.RENDERBUFFER, null)

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

void main (void) {
}
`

var shadowVertexShader = gl.createShader(gl.VERTEX_SHADER)
gl.shaderSource(shadowVertexShader, shadowVertexGLSL)
gl.compileShader(shadowVertexShader)

var shadowFragmentShader = gl.createShader(gl.FRAGMENT_SHADER)
gl.shaderSource(shadowFragmentShader, fragmentGLSL)
gl.compileShader(shadowFragmentShader)

var shadowProgram = gl.createProgram()
gl.attachShader(shadowProgram, vertexShader)
gl.attachShader(shadowProgram, shadowFragmentShader)
gl.linkProgram(shadowProgram)
gl.useProgram(shadowProgram)

// TODO: Not sure what size this projection matrix is supposed to be. Need to calculate
// it so that it can see the entire scene
var lightProjectionMatrix = glMat4.perspective([], Math.PI / 3, 1, 0.01, 100)
var lightViewMatrix = glMat4.lookAt([], [1, 1, 0], [0, 0, 0], [0, 1, 0])

var shadowPMatrix = gl.getUniformLocation(shadowProgram, 'uPMatrix')
var shadowMVMatrix = gl.getUniformLocation(shadowProgram, 'uMVMatrix')

gl.uniformMatrix4fv(shadowPMatrix, false, lightProjectionMatrix)
gl.uniformMatrix4fv(shadowMVMatrix, false, lightViewMatrix)

gl.drawElements(gl.TRIANGLES, vertexIndices.length, gl.UNSIGNED_BYTE, 0)
gl.bindFramebuffer(gl.FRAMEBUFFER, null)
