<script setup lang="ts">
defineProps<{
  title?: string
  sortable: boolean
  isSorted: boolean
  sortIcon?: string | null
}>()

const emit = defineEmits<{
  sort: []
  resizeStart: [event: PointerEvent]
}>()
</script>

<template>
  <div class="draft-col-header">
    <span
      class="draft-col-header__label"
      :class="{ 'draft-col-header__label--sortable': sortable }"
      @click="sortable && emit('sort')"
    >
      {{ title }}
      <v-icon
        v-if="isSorted && sortIcon"
        :icon="sortIcon"
        size="14"
        class="draft-col-header__sort"
      />
    </span>
    <span
      class="draft-col-header__grip"
      title="Drag to resize"
      @pointerdown.stop.prevent="emit('resizeStart', $event)"
      @click.stop
    />
  </div>
</template>

<style scoped lang="scss">
.draft-col-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: 4px;

  &__label {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;

    &--sortable {
      cursor: pointer;
    }
  }

  &__sort {
    flex-shrink: 0;
    color: rgb(var(--v-theme-primary));
  }

  // Resize affordance pinned to the right edge of the header cell.
  &__grip {
    flex-shrink: 0;
    align-self: stretch;
    width: 8px;
    margin-right: -8px;
    cursor: col-resize;
    border-right: 2px solid transparent;
    transition: border-color 120ms ease;
    touch-action: none;

    &:hover {
      border-right-color: rgb(var(--v-theme-primary));
    }
  }
}
</style>
