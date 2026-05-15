import { lazy } from 'react'
import { Home } from '@/page'
import { Navigate, RouteObject } from 'react-router-dom'

const ModelPage = lazy(() => import('@/page/model').then((m) => ({ default: m.ModelPage })))
const FvcomPage = lazy(() => import('@/page/model/fvcom/FvcomPage'))

export const routes: RouteObject[] = [
    {
        path: '/',
        element: <Navigate to={'/home'}></Navigate>,
    },
    {
        path: '/home',
        element: <Home></Home>,
    },
    {
        path: '/model',
        element: <ModelPage></ModelPage>,
    },
    {
        path: '/fvcom',
        element: <FvcomPage />,
    },
]
