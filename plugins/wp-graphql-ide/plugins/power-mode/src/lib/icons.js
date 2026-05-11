import { SVG, Path } from '@wordpress/primitives';

// Lightning bolt — Power Mode's toggle icon. Inlined rather than
// pulled from @wordpress/icons so the plugin doesn't pin a specific
// icon-pack version to find one; SVG path is the standard Material
// "flash_on" glyph at 24×24.
export const lightning = (
	<SVG xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
		<Path d="M7 2v11h3v9l7-12h-4l3-8z" />
	</SVG>
);
