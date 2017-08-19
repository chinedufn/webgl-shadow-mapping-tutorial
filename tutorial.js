var glMat4 = require('gl-mat4')

var canvas = document.createElement('canvas')
canvas.width = 500
canvas.height = 500
var gl = canvas.getContext('webgl')
var mountLocation = document.getElementById('webgl-shadow-mapping-tut') || document.body
mountLocation.appendChild(canvas)

var vertexGLSL = `
attribute vec3 aVertexPosition;

uniform mat4 uPMatrix;
uniform mat4 uMVMatrix;
uniform mat4 lightViewMatrix;
uniform mat4 uLightProjection;
const mat4 biasMatrix = mat4(0.5, 0.0, 0.0, 0.0, 0.0, 0.5, 0.0, 0.0, 0.0, 0.0, 0.5, 0.0, 0.5, 0.5, 0.5, 1.0);

varying vec2 vDepthUv;
varying vec4 shadowPos;

void main (void) {
  gl_Position = uPMatrix * uMVMatrix * vec4(aVertexPosition, 1.0);

  shadowPos = uPMatrix * lightViewMatrix * uMVMatrix * vec4(aVertexPosition, 1.0);
  shadowPos = biasMatrix * uLightProjection * lightViewMatrix * vec4(aVertexPosition, 1.0);
}
`

var fragmentGLSL = `
precision mediump float;

varying vec2 vDepthUv;
varying vec4 shadowPos;

uniform sampler2D depthColorTexture;

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
  vec3 fragmentDepth = shadowPos.xyz / shadowPos.w;
  // fragmentDepth.z -= 0.0003;

  float lightDepth = unpack(texture2D(depthColorTexture, fragmentDepth.xy));

  vec4 color;
  if (fragmentDepth.z < lightDepth) {
    color = vec4(1.0, 1.0, 1.0, 1.0);
  } else {
    color = vec4(0.0, 0.0, 0.0, 1.0);
  }

  gl_FragColor = color;
  // gl_FragColor = texture2D(depthColorTexture, vDepthUv);
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
var vertexUvs = [
  // Front Bottom Left
  0.0, 0.0,
  // Front Bottom Right
  1.0, 0.0,
  // Front Top Right
  1.0, 1.0,
  // Front Top Left
  0.0, 1.0,
  // Back Bottom Left
  0.0, 0.0,
  // Back Bottom Right
  1.0, 0.0,
  // Back Top Right
  1.0, 1.0,
  // Back Top Left
  0.0, 1.0
]

/**
 * Shadow
 */
gl.useProgram(shadowProgram)

var vertexPositionAttrib = gl.getAttribLocation(shadowProgram, 'aVertexPosition')
gl.enableVertexAttribArray(vertexPositionAttrib)

var vertexPositionBuffer = gl.createBuffer()
gl.bindBuffer(gl.ARRAY_BUFFER, vertexPositionBuffer)
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertexPositions), gl.STATIC_DRAW)
gl.vertexAttribPointer(vertexPositionAttrib, 3, gl.FLOAT, false, 0, 0)

var vertexIndexBuffer = gl.createBuffer()
gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, vertexIndexBuffer)
gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(vertexIndices), gl.STATIC_DRAW)

var shadowFramebuffer = gl.createFramebuffer()
gl.bindFramebuffer(gl.FRAMEBUFFER, shadowFramebuffer)

var shadowDepthTexture = gl.createTexture()
gl.bindTexture(gl.TEXTURE_2D, shadowDepthTexture)
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST)
// gl.generateMipmap(gl.TEXTURE_2D)
// gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
// gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 512, 512, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)

var renderBuffer = gl.createRenderbuffer()
gl.bindRenderbuffer(gl.RENDERBUFFER, renderBuffer)
gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, 512, 512)

gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, shadowDepthTexture, 0)
gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, renderBuffer)

gl.bindTexture(gl.TEXTURE_2D, null)
gl.bindRenderbuffer(gl.RENDERBUFFER, null)

var lightProjectionMatrix = glMat4.ortho([], -5, 5, -5, 5, -5, 5)
var lightViewMatrix = glMat4.lookAt([], [1, 1, 0], [0, 0, 0], [0, 1, 0])

lightViewMatrix = glMat4.lookAt([], [0, 2, 2.5], [0, 0, 0], [0, 1, 0])
lightViewMatrix = glMat4.lookAt([], [0, 1, 1], [0, 0, 0], [0, 1, 0])

var shadowPMatrix = gl.getUniformLocation(shadowProgram, 'uPMatrix')
var shadowMVMatrix = gl.getUniformLocation(shadowProgram, 'uMVMatrix')

gl.uniformMatrix4fv(shadowPMatrix, false, lightProjectionMatrix)
gl.uniformMatrix4fv(shadowMVMatrix, false, lightViewMatrix)

gl.viewport(0, 0, 512, 512)
gl.clearColor(0, 0, 0, 1)
gl.clearDepth(1.0)
gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

gl.drawElements(gl.TRIANGLES, vertexIndices.length, gl.UNSIGNED_SHORT, 0)

gl.bindTexture(gl.TEXTURE_2D, shadowDepthTexture)
gl.generateMipmap(gl.TEXTURE_2D)
gl.bindTexture(gl.TEXTURE_2D, null)

gl.bindFramebuffer(gl.FRAMEBUFFER, null)

/**
 * Scene
 */
gl.useProgram(shaderProgram)
gl.viewport(0, 0, 500, 500)
gl.clearColor(1, 0, 1, 1)
gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

var vertexPositionAttrib = gl.getAttribLocation(shaderProgram, 'aVertexPosition')
gl.enableVertexAttribArray(vertexPositionAttrib)

// TODO: Rename
var samplerUniform = gl.getUniformLocation(shaderProgram, 'depthColorTexture')

gl.activeTexture(gl.TEXTURE0)
gl.bindTexture(gl.TEXTURE_2D, shadowDepthTexture)
gl.uniform1i(samplerUniform, 0)

var vertexPositionBuffer = gl.createBuffer()
gl.bindBuffer(gl.ARRAY_BUFFER, vertexPositionBuffer)
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertexPositions), gl.STATIC_DRAW)
gl.vertexAttribPointer(vertexPositionAttrib, 3, gl.FLOAT, false, 0, 0)

var vertexIndexBuffer = gl.createBuffer()
gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, vertexIndexBuffer)
gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(vertexIndices), gl.STATIC_DRAW)

var uMVMatrix = gl.getUniformLocation(shaderProgram, 'uMVMatrix')
var uPMatrix = gl.getUniformLocation(shaderProgram, 'uPMatrix')
var uLightMatrix = gl.getUniformLocation(shaderProgram, 'lightViewMatrix')
var uLightProjection = gl.getUniformLocation(shaderProgram, 'lightProjectionMatrix')

var camera = glMat4.lookAt([], [0, 2, 2.5], [0, 0, 0], [0, 1, 0])
camera = glMat4.lookAt([], [2.5, 3, 3.5], [0, 0, 0], [0, 1, 0])
gl.uniformMatrix4fv(uMVMatrix, false, camera)
gl.uniformMatrix4fv(uPMatrix, false, glMat4.perspective([], Math.PI / 3, 1, 0.01, 100))

gl.uniformMatrix4fv(uLightMatrix, false, lightViewMatrix)
gl.uniformMatrix4fv(uLightProjection, false, lightProjectionMatrix)

gl.drawElements(gl.TRIANGLES, vertexIndices.length, gl.UNSIGNED_SHORT, 0)

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
   createImageFromTexture(gl, shadowDepthTexture, 512, 512)
)
