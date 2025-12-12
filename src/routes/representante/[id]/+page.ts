// src/routes/representante/[id]/+page.ts
import type { PageLoad } from "./$types";

export const load: PageLoad = ({ params }) => {
	return {
		id: params.id
	};
};
