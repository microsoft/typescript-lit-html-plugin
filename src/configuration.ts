// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

export interface TsHtmlPluginConfiguration {
    tags: string[];
    format: {
        enabled: boolean
    };
}

export const defaultConfiguration: TsHtmlPluginConfiguration = {
    tags: ['html', 'raw'],
    format: {
        enabled: true,
    },
};

export const loadConfiguration = (config: any): TsHtmlPluginConfiguration => {
    const format = Object.assign({}, defaultConfiguration.format, config.format);
    return {
        tags: config.tags || defaultConfiguration.tags,
        format,
    };
};