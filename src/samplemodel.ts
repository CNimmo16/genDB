export default {
  tables: [
    {
      name: "Users",
      columns: [
        {
          name: "UserID",
          isPrimaryKey: true,
          type: "text",
          foreignKey: { referencedTable: "", referencedColumn: "" },
        },
        {
          name: "Username",
          isPrimaryKey: false,
          type: "text",
          foreignKey: { referencedTable: "", referencedColumn: "" },
        },
        {
          name: "Email",
          isPrimaryKey: false,
          type: "text",
          foreignKey: { referencedTable: "", referencedColumn: "" },
        },
        {
          name: "PasswordHash",
          isPrimaryKey: false,
          type: "text",
          foreignKey: { referencedTable: "", referencedColumn: "" },
        },
        {
          name: "UserType",
          isPrimaryKey: false,
          type: "text",
          foreignKey: { referencedTable: "", referencedColumn: "" },
        },
      ],
    },
    {
      name: "CreditProviders",
      columns: [
        {
          name: "ProviderID",
          isPrimaryKey: true,
          type: "text",
          foreignKey: { referencedTable: "", referencedColumn: "" },
        },
        {
          name: "ProviderName",
          isPrimaryKey: false,
          type: "text",
          foreignKey: { referencedTable: "", referencedColumn: "" },
        },
        {
          name: "ContactEmail",
          isPrimaryKey: false,
          type: "text",
          foreignKey: { referencedTable: "", referencedColumn: "" },
        },
        {
          name: "ContactNumber",
          isPrimaryKey: false,
          type: "text",
          foreignKey: { referencedTable: "", referencedColumn: "" },
        },
      ],
    },
    {
      name: "LoanProducts",
      columns: [
        {
          name: "LoanID",
          isPrimaryKey: true,
          type: "text",
          foreignKey: { referencedTable: "", referencedColumn: "" },
        },
        {
          name: "ProviderID",
          isPrimaryKey: false,
          type: "text",
          foreignKey: {
            referencedTable: "CreditProviders",
            referencedColumn: "ProviderID",
          },
        },
        {
          name: "LoanType",
          isPrimaryKey: false,
          type: "text",
          foreignKey: { referencedTable: "", referencedColumn: "" },
        },
        {
          name: "InterestRate",
          isPrimaryKey: false,
          type: "integer",
          foreignKey: { referencedTable: "", referencedColumn: "" },
        },
        {
          name: "AmountRange",
          isPrimaryKey: false,
          type: "text",
          foreignKey: { referencedTable: "", referencedColumn: "" },
        },
        {
          name: "TermRange",
          isPrimaryKey: false,
          type: "text",
          foreignKey: { referencedTable: "", referencedColumn: "" },
        },
      ],
    },
    {
      name: "Applications",
      columns: [
        {
          name: "ApplicationID",
          isPrimaryKey: true,
          type: "text",
          foreignKey: { referencedTable: "", referencedColumn: "" },
        },
        {
          name: "UserID",
          isPrimaryKey: false,
          type: "text",
          foreignKey: { referencedTable: "Users", referencedColumn: "UserID" },
        },
        {
          name: "LoanID",
          isPrimaryKey: false,
          type: "text",
          foreignKey: {
            referencedTable: "LoanProducts",
            referencedColumn: "LoanID",
          },
        },
        {
          name: "Status",
          isPrimaryKey: false,
          type: "text",
          foreignKey: { referencedTable: "", referencedColumn: "" },
        },
        {
          name: "SubmissionDate",
          isPrimaryKey: false,
          type: "datetime",
          foreignKey: { referencedTable: "", referencedColumn: "" },
        },
      ],
    },
    {
      name: "ApplicationReviews",
      columns: [
        {
          name: "ReviewID",
          isPrimaryKey: true,
          type: "text",
          foreignKey: { referencedTable: "", referencedColumn: "" },
        },
        {
          name: "ApplicationID",
          isPrimaryKey: false,
          type: "text",
          foreignKey: {
            referencedTable: "Applications",
            referencedColumn: "ApplicationID",
          },
        },
        {
          name: "ReviewerUserID",
          isPrimaryKey: false,
          type: "text",
          foreignKey: { referencedTable: "Users", referencedColumn: "UserID" },
        },
        {
          name: "ReviewDate",
          isPrimaryKey: false,
          type: "datetime",
          foreignKey: { referencedTable: "", referencedColumn: "" },
        },
        {
          name: "Comments",
          isPrimaryKey: false,
          type: "text",
          foreignKey: { referencedTable: "", referencedColumn: "" },
        },
      ],
    },
    {
      name: "ApplicantQueries",
      columns: [
        {
          name: "QueryID",
          isPrimaryKey: true,
          type: "text",
          foreignKey: { referencedTable: "", referencedColumn: "" },
        },
        {
          name: "ApplicationID",
          isPrimaryKey: false,
          type: "text",
          foreignKey: {
            referencedTable: "Applications",
            referencedColumn: "ApplicationID",
          },
        },
        {
          name: "QueryDate",
          isPrimaryKey: false,
          type: "datetime",
          foreignKey: { referencedTable: "", referencedColumn: "" },
        },
        {
          name: "QueryText",
          isPrimaryKey: false,
          type: "text",
          foreignKey: { referencedTable: "", referencedColumn: "" },
        },
        {
          name: "ResponseText",
          isPrimaryKey: false,
          type: "text",
          foreignKey: { referencedTable: "", referencedColumn: "" },
        },
        {
          name: "ResponseDate",
          isPrimaryKey: false,
          type: "datetime",
          foreignKey: { referencedTable: "", referencedColumn: "" },
        },
      ],
    },
    {
      name: "UserProfiles",
      columns: [
        {
          name: "UserID",
          isPrimaryKey: true,
          type: "text",
          foreignKey: { referencedTable: "Users", referencedColumn: "UserID" },
        },
        {
          name: "FullName",
          isPrimaryKey: false,
          type: "text",
          foreignKey: { referencedTable: "", referencedColumn: "" },
        },
        {
          name: "Address",
          isPrimaryKey: false,
          type: "text",
          foreignKey: { referencedTable: "", referencedColumn: "" },
        },
        {
          name: "PhoneNumber",
          isPrimaryKey: false,
          type: "text",
          foreignKey: { referencedTable: "", referencedColumn: "" },
        },
        {
          name: "DateOfBirth",
          isPrimaryKey: false,
          type: "datetime",
          foreignKey: { referencedTable: "", referencedColumn: "" },
        },
      ],
    },
    {
      name: "ApplicationDocuments",
      columns: [
        {
          name: "DocumentID",
          isPrimaryKey: true,
          type: "text",
          foreignKey: { referencedTable: "", referencedColumn: "" },
        },
        {
          name: "ApplicationID",
          isPrimaryKey: false,
          type: "text",
          foreignKey: {
            referencedTable: "Applications",
            referencedColumn: "ApplicationID",
          },
        },
        {
          name: "FileName",
          isPrimaryKey: false,
          type: "text",
          foreignKey: { referencedTable: "", referencedColumn: "" },
        },
        {
          name: "FileURL",
          isPrimaryKey: false,
          type: "text",
          foreignKey: { referencedTable: "", referencedColumn: "" },
        },
        {
          name: "UploadDate",
          isPrimaryKey: false,
          type: "datetime",
          foreignKey: { referencedTable: "", referencedColumn: "" },
        },
      ],
    },
    {
      name: "Notifications",
      columns: [
        {
          name: "NotificationID",
          isPrimaryKey: true,
          type: "text",
          foreignKey: { referencedTable: "", referencedColumn: "" },
        },
        {
          name: "UserID",
          isPrimaryKey: false,
          type: "text",
          foreignKey: { referencedTable: "Users", referencedColumn: "UserID" },
        },
        {
          name: "Message",
          isPrimaryKey: false,
          type: "text",
          foreignKey: { referencedTable: "", referencedColumn: "" },
        },
        {
          name: "NotificationDate",
          isPrimaryKey: false,
          type: "datetime",
          foreignKey: { referencedTable: "", referencedColumn: "" },
        },
        {
          name: "ReadStatus",
          isPrimaryKey: false,
          type: "boolean",
          foreignKey: { referencedTable: "", referencedColumn: "" },
        },
      ],
    },
    {
      name: "ProviderReviews",
      columns: [
        {
          name: "ReviewID",
          isPrimaryKey: true,
          type: "text",
          foreignKey: { referencedTable: "", referencedColumn: "" },
        },
        {
          name: "ProviderID",
          isPrimaryKey: false,
          type: "text",
          foreignKey: {
            referencedTable: "CreditProviders",
            referencedColumn: "ProviderID",
          },
        },
        {
          name: "UserID",
          isPrimaryKey: false,
          type: "text",
          foreignKey: { referencedTable: "Users", referencedColumn: "UserID" },
        },
        {
          name: "Rating",
          isPrimaryKey: false,
          type: "integer",
          foreignKey: { referencedTable: "", referencedColumn: "" },
        },
        {
          name: "Comments",
          isPrimaryKey: false,
          type: "text",
          foreignKey: { referencedTable: "", referencedColumn: "" },
        },
        {
          name: "ReviewDate",
          isPrimaryKey: false,
          type: "datetime",
          foreignKey: { referencedTable: "", referencedColumn: "" },
        },
      ],
    },
  ],
};
