<?php
/**
 * Plugin Name: WPGraphQL IDE Power Mode
 * Description: Particles + combo counter + screen shake for IDE keystrokes, with per-user stats persisted through the GraphQL API the IDE itself talks to. The point isn't the gimmick — it's that a fun client-side feature exercises the same query / mutation surface plugin authors and frontend devs will write against.
 */

declare(strict_types = 1);

namespace WPGraphQLIDE\PowerMode;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

const USER_META_KEY = 'wpgraphql_ide_power_mode_stats';

/**
 * Default empty stats shape. Stored as a single user_meta blob so the
 * client can hydrate / write it in one round-trip without a custom
 * schema or join.
 *
 * @return array{maxCombo:int,totalKeystrokes:int,lastSessionAt:?string}
 */
function default_stats(): array {
	return [
		'maxCombo'        => 0,
		'totalKeystrokes' => 0,
		'lastSessionAt'   => null,
	];
}

/**
 * Read stats for a user, merging the stored blob into the default
 * shape so newly-added fields don't surface as null in GraphQL.
 *
 * @param int $user_id
 *
 * @return array{maxCombo:int,totalKeystrokes:int,lastSessionAt:?string}
 */
function read_stats( int $user_id ): array {
	$stored = get_user_meta( $user_id, USER_META_KEY, true );
	if ( ! is_array( $stored ) ) {
		return default_stats();
	}
	return array_merge( default_stats(), $stored );
}

function enqueue_assets(): void {
	$asset_path = plugin_dir_path( __FILE__ ) . 'build/power-mode.asset.php';
	if ( ! file_exists( $asset_path ) ) {
		return;
	}
	$asset_file = include $asset_path;
	if ( empty( $asset_file['dependencies'] ) ) {
		return;
	}

	wp_enqueue_script(
		'power-mode',
		plugin_dir_url( __FILE__ ) . 'build/power-mode.js',
		array_merge( $asset_file['dependencies'], [ 'wpgraphql-ide' ] ),
		$asset_file['version'],
		true
	);
}
add_action( 'wpgraphql_ide_enqueue_script', __NAMESPACE__ . '\enqueue_assets' );

add_action(
	'graphql_register_types',
	static function (): void {

		register_graphql_object_type(
			'IdePowerStats',
			[
				'description' => __( 'Per-user stats accumulated by the WPGraphQL IDE Power Mode plugin.', 'wp-graphql-ide' ),
				'fields'      => [
					'maxCombo'        => [
						'type'        => 'Int',
						'description' => __( 'The highest consecutive-keystroke combo this user has reached.', 'wp-graphql-ide' ),
					],
					'totalKeystrokes' => [
						'type'        => 'Int',
						'description' => __( 'Lifetime keystroke count recorded while Power Mode was active.', 'wp-graphql-ide' ),
					],
					'lastSessionAt'   => [
						'type'        => 'String',
						'description' => __( 'ISO-8601 timestamp of the last submitted Power Mode session, or null if none.', 'wp-graphql-ide' ),
					],
				],
			]
		);

		register_graphql_field(
			'User',
			'idePowerStats',
			[
				'type'        => 'IdePowerStats',
				'description' => __( 'Power Mode stats for the requested user. Visible to the user themselves and to any caller that can manage the IDE.', 'wp-graphql-ide' ),
				'resolve'     => static function ( $user ) {
					$user_id = is_object( $user ) && isset( $user->userId )
						? (int) $user->userId
						: 0;
					if ( ! $user_id ) {
						return null;
					}
					$viewer = get_current_user_id();
					if ( $viewer !== $user_id && ! current_user_can( 'manage_graphql_ide' ) ) {
						return null;
					}
					return read_stats( $user_id );
				},
			]
		);

		register_graphql_mutation(
			'recordIdePowerCombo',
			[
				'description'         => __( 'Submit a Power Mode session for the current user. Persists a new max combo when the submitted value beats the stored one; otherwise just increments the keystroke counter.', 'wp-graphql-ide' ),
				'inputFields'         => [
					'combo'      => [
						'type'        => [ 'non_null' => 'Int' ],
						'description' => __( 'Highest combo reached in this session.', 'wp-graphql-ide' ),
					],
					'keystrokes' => [
						'type'        => [ 'non_null' => 'Int' ],
						'description' => __( 'Total keystrokes recorded in this session.', 'wp-graphql-ide' ),
					],
				],
				'outputFields'        => [
					'stats'       => [
						'type'        => 'IdePowerStats',
						'description' => __( 'The user\'s post-update Power Mode stats.', 'wp-graphql-ide' ),
					],
					'beatPrevious' => [
						'type'        => [ 'non_null' => 'Boolean' ],
						'description' => __( 'True when the submitted combo set a new personal record.', 'wp-graphql-ide' ),
					],
				],
				'mutateAndGetPayload' => static function ( $input ) {
					$viewer = get_current_user_id();
					if ( ! $viewer ) {
						throw new \GraphQL\Error\UserError(
							esc_html__( 'You must be signed in to record a Power Mode session.', 'wp-graphql-ide' )
						);
					}
					$combo      = max( 0, (int) ( $input['combo'] ?? 0 ) );
					$keystrokes = max( 0, (int) ( $input['keystrokes'] ?? 0 ) );

					$stats         = read_stats( $viewer );
					$beat_previous = $combo > (int) $stats['maxCombo'];

					$next = [
						'maxCombo'        => max( (int) $stats['maxCombo'], $combo ),
						'totalKeystrokes' => (int) $stats['totalKeystrokes'] + $keystrokes,
						'lastSessionAt'   => gmdate( 'c' ),
					];
					update_user_meta( $viewer, USER_META_KEY, $next );

					return [
						'stats'        => $next,
						'beatPrevious' => $beat_previous,
					];
				},
			]
		);
	}
);

/**
 * Register the meta key against the User CPT so the wp/v2/users REST
 * endpoint and `register_meta` consumers see a stable schema. Power
 * Mode itself reads / writes through the GraphQL surface above — this
 * is purely for cross-tool consistency.
 */
add_action(
	'init',
	static function (): void {
		register_meta(
			'user',
			USER_META_KEY,
			[
				'type'         => 'object',
				'single'       => true,
				'show_in_rest' => false,
				'default'      => default_stats(),
			]
		);
	}
);
