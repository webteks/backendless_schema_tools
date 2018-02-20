# backendless_schema_tools

To install and test this utility
 * Install this application globally ( npm install -g )
 * Help is provided in app by typing backendless_compare


 Compare database schema of two Backendless Applications

  -u, --username ['developer@company.com']               Required
  -p, --password ['developersPassowrd']                  Required
  -b, --backendless-url ['api.backendless.com']          Backendless URL Override
  -r, --application-control ['live (Reference) ']        Required: Reference Backendless Application name or path to dump-file
  -c, --applications-to-check ['dev (Comparison)']       Required: Space seperated array of application names or paths to compare ie:
                                                         dev alpha
  -d, --dump-application-control [./path/file.json]      Optional: Path to dump-file
  -t, --timeout [30000]                                  Default: 30000
  -v, --verbose                                          enables move verbose logging output
  -m, --monitor                                          enables monitor: return 0 if schemas are identical, or 1 - if not or if there is an error

Module for comparing applications details to a selected base.  Details to be compared; Schema tables table columns, column constraints, relationships, user and group permissions
