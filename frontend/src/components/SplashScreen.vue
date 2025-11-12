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

      <div class="text-body-1 text-center px-4 pb-4 splash-text">
        <p>As NBA fans, we've always felt the same frustration. You look up a team's draft history to see how the roster was built, but the data is misleading.</p>

        <br/>

        <p>You see a player listed who never played a single game for that team, only to remember, "Oh, right, he was traded on draft night." Meanwhile, the player the team <em>actually</em> drafted is listed on another team's history, as if they were the ones who drafted him.</p>

        <br/>

        <p>A perfect example is the 2018 draft. If you want to see the draft history for the Atlanta Hawks, you'll see that they selected Luka Dončić and the Dallas Mavericks selected Trae Young. For a fan trying to understand how those teams were built, this is backward and confusing.</p>

        <br/>

        <p>This website was built to solve that one, simple problem.</p>
      </div>

      <div class="d-flex justify-center pb-4 pb-md-8">
        <v-btn
          color="primary"
          size="large"
          variant="outlined"
          rounded="xl"
          append-icon="mdi-chevron-right"
          @click="handleContinue"
          class="continue-btn"
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
  font-family: "Barlow", sans-serif;
  overflow: auto;
  padding: 16px;
}

.splash-content {
  animation: fadeIn 0.5s ease-in-out;
  max-width: 90vw;
  width: 100%;
  max-height: 90vh;
  z-index: 1;
  position: relative;
  font-family: "Barlow", sans-serif;
  padding: 16px;
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;

  h1 {
    font-family: "Barlow", sans-serif !important;
    font-size: 1.75rem;
    padding: 16px 8px !important;
    margin: 0;
    flex-shrink: 0;
  }

  @media (min-width: 600px) {
    max-width: 80vw;
    padding: 24px;
    
    h1 {
      font-size: 2.125rem;
      padding: 24px 16px !important;
    }
  }

  @media (min-width: 960px) {
    max-width: 90vw;
    padding: 32px;
    
    h1 {
      font-size: 3rem;
      padding: 32px !important;
    }
  }
}

.splash-text {
  // No background - just floating text over blur
  font-family: "Barlow", sans-serif;
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  min-height: 0;
  
  p {
    margin-bottom: 12px;
    line-height: 1.6;
    word-wrap: break-word;
    overflow-wrap: break-word;
  }

  @media (min-width: 600px) {
    padding-left: 32px !important;
    padding-right: 32px !important;
  }

  @media (min-width: 960px) {
    padding-left: 32px !important;
    padding-right: 32px !important;
  }
}

.continue-btn {
  min-width: 120px;
  min-height: 44px;
  flex-shrink: 0;
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
