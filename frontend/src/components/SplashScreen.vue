<script setup lang="ts">
import { ref } from 'vue'

const emit = defineEmits<{
  continue: []
}>()

const visible = ref(true)

function handleContinue() {
  visible.value = false
  setTimeout(() => {
    emit('continue')
  }, 300)
}
</script>

<template>
  <v-overlay
    :model-value="visible"
    class="splash-screen"
    persistent
    scrim="rgba(0, 0, 0, 0.3)"
  >
    <div class="splash-content">
      <h1 class="text-h3 text-center pa-8 mb-4">
        Real Draft History
      </h1>

      <div class="text-body-1 text-center px-8 pb-4 splash-text">
        <p>As basketball fans, we've all felt the same frustration. You look up your favorite team's draft history to see how the roster was built, but the data is misleading.</p>

        <br/>

        <p>You see a player listed who never played a single game for your team, only to remember, "Oh, right, he was traded on draft night." Meanwhile, the player your team <em>actually</em> acquired in that deal is listed on another team's history, as if they were the ones who drafted him.</p>

        <br/>

        <p>A perfect example is the 2018 draft. If you want to see the draft history for the Atlanta Hawks, you'll see that they selected Luka Dončić and the Dallas Mavericks selected Trae Young. For a fan trying to understand how those teams were built, this is backward and confusing.</p>

        <br/>

        <p>This website was built to solve that one, simple problem.</p>
      </div>

      <div class="d-flex justify-center pb-8">
        <v-btn
          color="primary"
          size="large"
          variant="elevated"
          @click="handleContinue"
        >
          Continue
        </v-btn>
      </div>
    </div>
  </v-overlay>
</template>

<style scoped lang="scss">
.splash-screen {
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.splash-content {
  animation: fadeIn 0.5s ease-in-out;
  max-width: 80vw;
  z-index: 1;
  position: relative;
}

.splash-text {
  background-color: rgba(var(--v-theme-surface), 0.95);
  border-radius: 8px;
  padding: 24px;
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
</style>
