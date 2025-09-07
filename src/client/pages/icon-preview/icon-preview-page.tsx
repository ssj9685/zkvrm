import { Icon, iconNames } from "../../components/icons/icon";

export function IconPreviewPage() {
	return (
		<div className="p-4">
			<h1 className="text-2xl font-bold mb-4">Icon Preview</h1>
			<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
				{iconNames.map((name) => (
					<div
						key={name}
						className="flex flex-col items-center p-4 border rounded-lg shadow-sm"
					>
						<Icon name={name} className="w-12 h-12 mb-2" title={name} />
						<span className="text-sm text-gray-600">{name}</span>
					</div>
				))}
			</div>
		</div>
	);
}
