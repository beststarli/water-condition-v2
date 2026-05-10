interface AppProps {
    children: any
}

export const Header = ({ children }: AppProps) => {
    return (
        <div className="flex items-center fixed z-10 h-16 w-screen bg-[#135eb0] p-5 text-3xl font-bold tracking-widest text-white">
            {children}
        </div>
    )
}
