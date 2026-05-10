import { Home } from '@/page'
import { ModelPage } from '@/page/model'
import FvcomPage from '@/page/model/fvcom/FvcomPage'
import { Navigate, RouteObject } from 'react-router-dom'

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
