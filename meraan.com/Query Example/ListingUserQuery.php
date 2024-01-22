<?php

namespace App\GraphQL\Queries\Admin;

use Carbon\Carbon;
use App\Models\User;
use App\Helpers\UserHelper;

class ListingUserQuery
{
    /**
     * @param  null  $_
     * @param  array<string, mixed>  $args
     */
    public function listUsers($_, array $args)
    {
        if (isset($args)) {
            $args = UserHelper::validateEmptyInput($args);
        }

        $user = User::query()
            ->when($args['ByUserType'], function ($query) use ($args) {
                return $query->whereRoleId($args['ByUserType']);
            })
            ->when($args['byLastDays'], function ($query) use ($args) {
                return $query->whereDate('created_at', '>', Carbon::now()->subDays($args['byLastDays']));
            })
            ->when($args['registered_from'], function ($query) use ($args) {
                return $query->whereDate('created_at', '>=', $args['registered_from']);
            })
            ->when($args['registered_to'], function ($query) use ($args) {
                return $query->whereDate('created_at', '<=', $args['registered_to']);
            })
            ->when($args['search'], function ($query) use ($args) {

                if ($args['ByUserType'] == User::ROLES['organizer']) {

                    return  $query->Where('organizer_name', 'LIKE', '%' .  $args['search'] . '%')
                        ->orWhere('email', 'LIKE', '%' .  $args['search'] . '%')
                        ->whereNotIn('role_id', [User::ROLES['default'], User::ROLES['admin']]);
                }
                $user = $query->where('first_name', 'LIKE', '%' . $args['search'] . '%')
                    ->orWhere('last_name', 'LIKE', '%' .  $args['search'] . '%')
                    ->orWhere('email', 'LIKE', '%' .  $args['search'] . '%')
                    ->whereNotIn('role_id', [User::ROLES['default'], User::ROLES['organizer']]);

                return $user;
            })
            ->orderBy('created_at', 'DESC')
            ->get();

        return $user;
    }
}
