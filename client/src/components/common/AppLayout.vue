<script setup lang="ts">
import AppSidebar from './AppSidebar.vue'
import AppHeader from './AppHeader.vue'
import { RouterView } from 'vue-router'
</script>

<template>
  <div class="app-layout">
    <AppSidebar />
    <div class="main-area">
      <AppHeader />
      <main class="main-content">
        <RouterView />
      </main>
    </div>
  </div>
</template>

<style scoped>
.app-layout {
  display: flex;
  height: 100vh;
  overflow: hidden;
}
.main-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.main-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  background: var(--bg-color);
}
</style>
