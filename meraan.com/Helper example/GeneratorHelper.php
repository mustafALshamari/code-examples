<?php

namespace App\Helpers;

use Illuminate\Support\Facades\Validator;


class GeneratorHelper
{
    public static function generateCode($rangeFrom, $rangeTo, $fieldIdTableName, $table)
    {
        $codeToBeGenerated = [
            'code' => mt_rand($rangeFrom, $rangeTo)
        ];

        $rules = ["{$fieldIdTableName}" => "unique:{$table}"];

        $validate = Validator::make($codeToBeGenerated, $rules)->passes();

        return $validate ? $codeToBeGenerated['code'] : self::generateCode($rangeFrom, $rangeTo, $fieldIdTableName, $table);
    }
}
