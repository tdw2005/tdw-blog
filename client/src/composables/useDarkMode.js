import { ref, onMounted, watch } from 'vue'

export function useDarkMode() {
    const isDark = ref(false)

    onMounted(() => {
        // 从 localStorage 读取用户偏好
        const saved = localStorage.getItem('dark-mode')
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches

        isDark.value = saved ? JSON.parse(saved) : prefersDark
        applyTheme(isDark.value)
    })

    watch(isDark, (newVal) => {
        localStorage.setItem('dark-mode', JSON.stringify(newVal))
        applyTheme(newVal)
    })

    const toggleDarkMode = () => {
        isDark.value = !isDark.value
    }

    const applyTheme = (dark) => {
        if (dark) {
            document.documentElement.classList.add('dark')
        } else {
            document.documentElement.classList.remove('dark')
        }
    }

    return {
        isDark,
        toggleDarkMode
    }
}