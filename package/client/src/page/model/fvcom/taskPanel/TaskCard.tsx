import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'

type TaskCardProps = {
	name: string
	progress: number
	status: 'running' | 'completed'
	onCancel?: () => void
}

export default function TaskCard({
	name,
	progress,
	status,
	onCancel
}: TaskCardProps) {
	const safeProgress = Math.min(100, Math.max(0, progress))

	return (
		<Card className="shadow-sm">
			<CardHeader className="pb-2">
				<CardTitle>{name}</CardTitle>
			</CardHeader>
			<CardContent className="space-y-2">
				<Progress
					value={safeProgress}
					className={status === 'completed' ? 'bg-emerald-100 [&>div]:bg-emerald-500' : ''}
				/>
				<div className="flex items-center justify-between text-xs text-slate-500">
					{status === 'completed' ? (
						<span className="font-medium text-emerald-600">运行完成</span>
					) : (
						<>
							<span>进度 {safeProgress}%</span>
							<AlertDialog>
								<AlertDialogTrigger asChild>
									<Button size="sm" variant="destructive">
										取消任务
									</Button>
								</AlertDialogTrigger>
								<AlertDialogContent>
									<AlertDialogHeader>
										<AlertDialogTitle>确认取消任务？</AlertDialogTitle>
										<AlertDialogDescription>
											取消后任务将停止运行。
										</AlertDialogDescription>
									</AlertDialogHeader>
									<AlertDialogFooter>
										<AlertDialogCancel>继续运行</AlertDialogCancel>
										<AlertDialogAction onClick={onCancel}>
											确认取消
										</AlertDialogAction>
									</AlertDialogFooter>
								</AlertDialogContent>
							</AlertDialog>
						</>
					)}
				</div>
			</CardContent>
		</Card>
	)
}
