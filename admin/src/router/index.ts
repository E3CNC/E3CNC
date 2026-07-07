import { createRouter, createWebHistory } from 'vue-router'
import Dashboard from '@/views/Dashboard.vue'
import Instances from '@/views/Instances.vue'
import Releases from '@/views/Releases.vue'

const routes = [
  { path: '/', name: 'Dashboard', component: Dashboard },
  { path: '/instances', name: 'Instances', component: Instances },
  { path: '/releases', name: 'Releases', component: Releases },
]

const router = createRouter({
  history: createWebHistory('/'),
  routes,
})

export default router