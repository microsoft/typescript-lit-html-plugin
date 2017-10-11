// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

export interface TsHtmlPluginConfiguration {
    tags: string[];
}

export const defaultConfiguration: TsHtmlPluginConfiguration = {
    tags: ['html'],
};

export const loadConfiguration = (config: any): TsHtmlPluginConfiguration => {
    return {
        tags: config.tags || defaultConfiguration.tags,
    };
};