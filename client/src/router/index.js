import { createRouter, createWebHistory, createMemoryHistory } from 'vue-router'
import ArticleList from '../components/ArticleList.vue'
import ArticleDetail from '../components/ArticleDetail.vue'
import ArticleForm from '../components/ArticleForm.vue'
import Login from '../components/Login.vue'
import Register from '../components/Register.vue'
import Profile from '../components/Profile.vue'
import Drafts from '../components/Drafts.vue'
import { useAuth } from '../composables/useAuth'

const routes = [
    {
        path: '/',
        component: ArticleList,
        name: 'home'
    },
    {
        path: '/article/:id',
        component: ArticleDetail,
        name: 'article'
    },
    {
        path: '/create',
        component: ArticleForm,
        name: 'create'
    },
    {
        path: '/edit/:id',
        component: ArticleForm,
        name: 'edit',
        // 路由参数作为 props 传递给组件
        props: true
    },
    {
        path: '/login',
        component: Login,
        name: 'login'
    },
    {
        path: '/register',
        component: Register,
        name: 'register'
    },
    {
        path: '/profile',
        component: Profile,
        name: 'profile'
    },
    {
        path: '/drafts',
        component: Drafts,
        name: 'drafts'
    }
    ,
    {
        path: '/messages',
        component: () => import('../components/Notifications.vue'),
        name: 'messages'
    }
]

const router = createRouter({
    history: typeof window === 'undefined' ? createMemoryHistory() : createWebHistory(),
    routes
})

router.beforeEach((to, from, next) => {
    if (typeof window === 'undefined') { next(); return }
    const { isLoggedIn, openAuthModal } = useAuth()
    const protectedNames = new Set(['create', 'edit', 'drafts', 'messages'])
    if (protectedNames.has(to.name) && !isLoggedIn.value) {
        openAuthModal('prompt')
        next(from.fullPath || '/')
        return
    }
    next()
})

export default router
