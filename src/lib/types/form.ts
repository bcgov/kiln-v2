export interface Item {
	uuid: string;
  class?: string;
	type: string;
	name: string;
	description?: string;
	help_text?: string;
	is_required?: boolean;
	visible_web?: boolean;
	visible_pdf?: boolean;
  custom_visibility?: string;
	is_read_only?: boolean | string;
	save_on_submit?: boolean;
	order?: number;
	options?: FormOption[] | any[];
	parent_id?: string | number;
	attributes?: { [key: string]: any };
	databindings?: {
		source: string;
		path: string;
		order?: number;
		condition?: string;
	}[];
    elements?: Item[];
	children?: Item[];
  value?: any;
  repeaterData?: { [key: string]: any };
}

export interface Template {
	name: string;
	id: string;
	version: number;
	status: string;
	data: {
		comments?: string;
		created_at?: string;
		updated_at?: string;
	};
	dataSources: {
		name: string;
		type: string;
		endpoint: string;
		description?: string;
		params?: { [key: string]: any };
		body?: any;
		headers?: { [key: string]: any };
		host?: string;
		order?: number;
	}[];
	interface: any[];
	styles: {
		type: string;
		content: string;
	}[];
	scripts: {
		type: string;
		content: string;
	}[];
	elements: Item[];
}

export interface SavedFieldData {
	[key: string]: FieldValue | GroupFieldValueItem[];
}


export interface GroupFieldValueItem {
	[key: string]: FieldValue;
}

export interface SavedData {
	data: SavedFieldData;
	form_definition: Template;
	metadata: object;
	params?: object;
}

export type GroupState = { [key: string]: string }[];


// Form field base interface
export interface BaseFormField {
  type?: string;
  id?: string | null;
  label?: string;
  helperText?: string;
  value?: any;
  name?: string | null;
}

export interface TextInfoField extends BaseFormField {
  type: "text-info";
  value?: string | null;
}

export interface TextInputField extends BaseFormField {
  type: "text-input";
  value?: string | null;
}

export interface TextAreaField extends BaseFormField {
  type: "text-area";
  value?: string | null;
}

export interface DropdownField extends BaseFormField {
  type: "dropdown";
  value?: string | null;
}

export interface RadioField extends BaseFormField {
  type: "radio";
  value?: string | null;
}

export interface CheckboxField extends BaseFormField {
  type: "checkbox";
  value?: string | boolean | null;
}

export interface ToggleField extends BaseFormField {
  type: "toggle";
  value?: string | boolean | null;
}

export interface DateField extends BaseFormField {
  type: "date";
  value?: string | null;
}

export interface GroupField extends BaseFormField {
  type: "group";
  groupId?: string;
  repeater?: boolean;
  codeContext?: {
    name: string;
  };
  groupItems?: Array<{
    fields: FormField[];
  }>;
}

export type FormField =
  | TextInfoField
  | TextInputField
  | TextAreaField
  | DropdownField
  | RadioField
  | CheckboxField
  | ToggleField
  | DateField
  | GroupField;

// Data source interface
export interface DataSource {
  [key: string]: any;
}

// Form definition DTO
export interface FormDefinitionDto {
  id?: string;
  version: number;
  ministry_id: number;
  form_id: string;
  title: string;
  deployed_to: string;
  lastModified: string;
  data: {
    items: FormField[];
  };
  dataSources: DataSource[];
}

// Log entry DTO
export interface LogEntryDto {
  id: number;
  log_name: string;
  description: string;
  subject_type: string;
  subject_id: number;
  causer_type: string;
  causer_id: number;
  properties: {
    attributes: Record<string, any>;
    old?: Record<string, any>;
  };
  event: string;
  batch_uuid: string | null;
  created_at: string;
  updated_at: string;
}

// Form version DTO (matches returned JSON)
export interface FormVersionDto {
  id: number | string;
  form_id: number | string;
  version_number?: number;
  status: string;
}

// Form template DTO (matches returned JSON)
export interface FormTemplateDto {
  formversion: {
    name: string;
    id: string;
    version: number;
    status: string;
    data: {
      comments?: string | null;
      created_at?: string;
      updated_at?: string;
    };
    dataSources: {
      name: string;
      type: string;
      endpoint: string;
      description?: string | null;
      params?: { [key: string]: any };
      body?: any;
      headers?: { [key: string]: any };
      host?: string;
      order?: number;
    }[];
    interface: any[];
    styles: {
      type: string;
      content: string;
    }[];
    scripts: {
      type: string;
      content: string;
    }[];
    elements: Item[];
  };
  is_draft?: boolean;
  cache_source?: string;
  format?: string;
}

// API response DTO (matches returned JSON)
export interface ApiDataResponse {
  logs: LogEntryDto[];
  form_version: FormVersionDto;
  form_template: FormTemplateDto;
  [key: string]: any;
}



export interface URLParams {
  id: string;
  [key: string]: string | undefined;
}

export interface ApiDataItem {
  id?: string;
  value?: any;
  [key: string]: any;
}

// Option type for form fields
export type FormOption = {
	id?: number;
	optionable_type?: string;
	optionable_id?: number;
	label: string;
	order?: number;
	created_at?: string;
	updated_at?: string;
	value: string;
	[key: string]: any;
};


// --- Types ---
export type FieldValue = string | number | boolean | null | undefined | FieldValue[] | Record<string, any>;

export interface FormDefinition {
  form_id: string;
  title?: string;
  name?: string;
  [key: string]: any;
}
export interface FormData {
  data: { [key: string]: FieldValue };
  form_definition: FormDefinition;
  form_template?: FormTemplateDto;
  form_version?: FormVersionDto;
  metadata: Record<string, any>;
}
export interface SaveOptions {
  mode?: 'web' | 'pdf';
  formState: Record<string, FieldValue>;
  groupState?: Record<string, FieldValue[]>;
  formDefinition: FormDefinition;
  metadata?: Record<string, any>;
  items: Item[];
}


export interface FetchFormOptions {
	apiEndpoint: string;
	mode: string;
	useAuth?: boolean;
	usePortal?: boolean;
	parseSaveData?: boolean;
}