export const BUBBLE_VERTEX_SHADER = `
  attribute vec2 inPosition;
  varying vec2 v_uv;
  
  void main() {
    v_uv = inPosition * 0.5 + 0.5;
    gl_Position = vec4(inPosition, 0.0, 1.0);
  }
`;

export const BUBBLE_FRAGMENT_SHADER = `
  precision mediump float;
  
  uniform vec2 uResolution;
  uniform vec3 uBubbles[25];
  uniform vec3 uColors[25];
  
  varying vec2 v_uv;
  
  void main() {
    vec2 uv = v_uv * uResolution;
    
    float sum = 0.0;
    vec3 color = vec3(0.0);
    
    for (int i = 0; i < 25; i++) {
      vec3 bubble = uBubbles[i];
      vec3 col = uColors[i];
      
      vec2 pos = bubble.xy;
      float radius = bubble.z;
      float d = length(uv - pos);
      
      float influence = radius / max(d, 1.0);
      influence = pow(influence, 3.0); 
      
      sum += influence;
      color += col * influence;
    }
    
    float threshold = 0.4;

    if (sum < threshold) {
      gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
    } else {
      color /= sum;
      float alpha = smoothstep(threshold, threshold + 0.02, sum);
      gl_FragColor = vec4(color, alpha);
    }
  }
`;