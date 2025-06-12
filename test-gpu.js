// test-gpu.js
const si = require('systeminformation');

async function testGPU() {
  try {
    console.log('Getting GPU info...');
    const graphics = await si.graphics();
    console.log('GPU Info:', JSON.stringify(graphics, null, 2));
    
    if (graphics.controllers && graphics.controllers.length > 0) {
      console.log('\nDetected GPU:');
      console.log('Model:', graphics.controllers[0].model);
      console.log('Vendor:', graphics.controllers[0].vendor);
      console.log('VRAM:', graphics.controllers[0].vram, 'MB');
    } else {
      console.log('No GPU controllers detected');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

testGPU();