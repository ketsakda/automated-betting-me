import { createApp } from 'vue';
import './style.css';
import App from './App.vue';

console.log('Popup main.ts loading...');

try {
  const app = createApp(App);
  console.log('Vue app created');
  app.mount('#app');
  console.log('Vue app mounted');
} catch (error) {
  console.error('Failed to mount Vue app:', error);
  document.body.innerHTML = `<div style="padding: 20px; color: red;">Error: ${error}</div>`;
}
